// Electron entry point: wraps index.html in a desktop window. Only used for the .exe build;
// the game itself is plain HTML/JS and also runs by opening index.html in a browser.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 740, backgroundColor: '#120a10', title: 'The Super Slasher 5000',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('before-input-event', (e, input) => {      // F11 = fullscreen
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());   // the in-game EXIT button calls window.close()
