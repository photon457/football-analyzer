const http = require('http');
const { spawn } = require('child_process');

const VITE_URL = 'http://localhost:5173';
let electronProcess = null;

function checkViteReady() {
  http.get(VITE_URL, (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      console.log('Renderer dev server is ready. Starting Electron...');
      startElectron();
    } else {
      setTimeout(checkViteReady, 300);
    }
  }).on('error', () => {
    setTimeout(checkViteReady, 300);
  });
}

function startElectron() {
  const electronBin = require('electron');
  electronProcess = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  electronProcess.on('close', (code) => {
    process.exit(code || 0);
  });
}

console.log('Waiting for Vite server on port 5173...');
checkViteReady();
