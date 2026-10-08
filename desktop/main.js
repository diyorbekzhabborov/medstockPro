const { app, BrowserWindow } = require('electron');
const path = require('path');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Start internal offline server directly inside the Electron app
  // Built-in node:sqlite means zero external Node runtime required!
  require('./server');

  let mainWindow = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 1024,
      minHeight: 720,
      title: 'MedStock Pro — Рабочее место склада (Windows App)',
      backgroundColor: '#F8FAFC',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      autoHideMenuBar: true
    });

    // Load the warehouse application
    mainWindow.loadURL('http://localhost:3000');

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
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
}

