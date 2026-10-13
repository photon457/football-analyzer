const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 1080,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    }
  });

  await win.loadURL('http://localhost:5173');
  // Wait 2 seconds for react to render and fetch data
  await new Promise((r) => setTimeout(r, 2000));

  const result = await win.webContents.executeJavaScript(`(() => {
    // Switch to Pitch & Spatial Analytics if possible
    const buttons = Array.from(document.querySelectorAll('button'));
    const spatialBtn = buttons.find(b => b.textContent && b.textContent.includes('Pitch & Spatial'));
    if (spatialBtn) spatialBtn.click();
    
    return new Promise(res => {
      setTimeout(() => {
        const bodyHeight = document.body.scrollHeight;
        const htmlHeight = document.documentElement.scrollHeight;
        const rootHeight = document.getElementById('root')?.scrollHeight;
        const entryHeight = document.querySelector('.entry-window')?.scrollHeight;
        const shellHeight = document.querySelector('.app-layout-shell')?.scrollHeight;
        const mainHeight = document.querySelector('main')?.scrollHeight;

        // Check all direct children of body and root
        const bodyChildren = Array.from(document.body.children).map(c => ({
          tag: c.tagName,
          id: c.id,
          class: c.className,
          offsetHeight: c.offsetHeight,
          scrollHeight: c.scrollHeight,
          rect: c.getBoundingClientRect()
        }));

        const rootChildren = Array.from(document.getElementById('root')?.children || []).map(c => ({
          tag: c.tagName,
          id: c.id,
          class: c.className,
          offsetHeight: c.offsetHeight,
          scrollHeight: c.scrollHeight,
          rect: c.getBoundingClientRect()
        }));

        const entryChildren = Array.from(document.querySelector('.entry-window')?.children || []).map(c => ({
          tag: c.tagName,
          id: c.id,
          class: c.className,
          offsetHeight: c.offsetHeight,
          scrollHeight: c.scrollHeight,
          rect: c.getBoundingClientRect()
        }));

        res({
          bodyHeight,
          htmlHeight,
          rootHeight,
          entryHeight,
          shellHeight,
          mainHeight,
          bodyChildren,
          rootChildren,
          entryChildren,
        });
      }, 1000);
    });
  })()`);

  console.log(JSON.stringify(result, null, 2));
  app.quit();
});
