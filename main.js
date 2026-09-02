const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

function createWindow () {
  // Load your image file directly as the application icon
  const appIcon = nativeImage.createFromPath(path.join(__dirname, 'Logo_and_Favicon-removebg-preview.jpg'));

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    icon: appIcon // Sets the window and taskbar icon dynamically
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
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