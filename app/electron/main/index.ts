import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(maxRetries = 40, delayMs = 250): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await checkHealth();
    if (ok) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function resolvePythonExecutable(): string {
  // 1. Packaged bundled python in resources
  if (app.isPackaged) {
    const bundledPython = path.join(process.resourcesPath, 'python', 'python.exe');
    if (fs.existsSync(bundledPython)) {
      return bundledPython;
    }
  }

  // 2. Local build-resources python
  const localBuildPython = path.join(app.getAppPath(), 'build-resources', 'python', 'python.exe');
  if (fs.existsSync(localBuildPython)) {
    return localBuildPython;
  }

  // 3. System python
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveBackendEntry(): string {
  if (app.isPackaged) {
    const packagedEntry = path.join(process.resourcesPath, 'backend', 'server_entry.py');
    if (fs.existsSync(packagedEntry)) {
      return packagedEntry;
    }
  }
  return path.join(app.getAppPath(), 'backend', 'server_entry.py');
}

function resolveFixturesPath(): string {
  const filename = 'Fictional_Premier_League_2024_25_Fixture_Allocation.csv';
  if (app.isPackaged) {
    const packagedFixtures = path.join(process.resourcesPath, filename);
    if (fs.existsSync(packagedFixtures)) {
      return packagedFixtures;
    }
  }
  return path.join(app.getAppPath(), filename);
}

function ensureUserDataDatabase(): string {
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const userDbPath = path.join(dataDir, 'football_analyzer.db');
  let needsSeed = true;
  try {
    if (fs.existsSync(userDbPath) && fs.statSync(userDbPath).size > 0) {
      needsSeed = false;
    }
  } catch {
    needsSeed = true;
  }

  if (needsSeed) {
    // Copy initial pre-seeded database
    const seedCandidates = [
      path.join(process.resourcesPath, 'data', 'football_analyzer.db'),
      path.join(app.getAppPath(), 'data', 'football_analyzer.db'),
    ];

    for (const seedPath of seedCandidates) {
      if (fs.existsSync(seedPath)) {
        try {
          fs.copyFileSync(seedPath, userDbPath);
          console.log(`Initialized user database from seed: ${seedPath} -> ${userDbPath}`);
          break;
        } catch (err) {
          console.error(`Failed to copy seed database: ${err}`);
        }
      }
    }
  }

  return userDbPath;
}

async function startBackendService(): Promise<void> {
  const alreadyRunning = await checkHealth();
  if (alreadyRunning) {
    console.log('Analysis backend is already running on port 8000.');
    return;
  }

  const pythonExec = resolvePythonExecutable();
  const serverScript = resolveBackendEntry();
  const userDbPath = ensureUserDataDatabase();
  const fixturesPath = resolveFixturesPath();

  console.log('Spawning Python analysis backend:');
  console.log(`  Python: ${pythonExec}`);
  console.log(`  Script: ${serverScript}`);
  console.log(`  Database: ${userDbPath}`);

  const resourcesDir = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const pythonHome = path.dirname(pythonExec);

  const env = {
    ...process.env,
    PORT: '8000',
    HOST: '127.0.0.1',
    FOOTBALL_DB_PATH: userDbPath,
    FIXTURES_CSV_PATH: fixturesPath,
    PYTHONPATH: resourcesDir,
    PYTHONHOME: pythonHome,
  };

  try {
    backendProcess = spawn(pythonExec, [serverScript], {
      env,
      stdio: 'ignore',
      windowsHide: true,
      detached: false,
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to spawn backend process:', err);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`);
      backendProcess = null;
    });

    const isReady = await waitForBackend();
    if (isReady) {
      console.log('Backend service successfully started and verified via /health.');
    } else {
      console.warn('Backend service did not report ready within timeout.');
    }
  } catch (err) {
    console.error('Error starting backend service:', err);
  }
}

function stopBackendService(): void {
  if (backendProcess && backendProcess.pid) {
    console.log(`Stopping backend process PID ${backendProcess.pid}...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        backendProcess.kill();
      }
    } catch (e) {
      console.error('Error killing backend process:', e);
    }
    backendProcess = null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'Tactical Analyst',
    backgroundColor: '#060607',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.setFullScreen(true);

  // Handle IPC communication
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:ping', () => 'pong');

  ipcMain.handle('dialog:openMatchFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Football Match Data File',
      properties: ['openFile'],
      filters: [
        { name: 'JSON Match Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return {
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Security: restrict navigation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await startBackendService();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendService();
});

app.on('will-quit', () => {
  stopBackendService();
});
