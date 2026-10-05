const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let serverProcess = null;
let mainWindow = null;

function checkServerReady() {
  return new Promise((resolve) => {
    const tryConnect = () => {
      const req = http.get('http://localhost:3000/api/local/sync-status', (res) => {
        resolve();
      });
      req.on('error', () => {
        setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });
}

function startLocalServer() {
  return new Promise((resolve) => {
    // Check if already active
    const testReq = http.get('http://localhost:3000/api/local/sync-status', (res) => {
      resolve();
    });
    testReq.on('error', () => {
      // Spawn using system Node (ABI compatible with better-sqlite3)
      serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
        cwd: __dirname,
        stdio: 'inherit',
        windowsHide: true
      });
      checkServerReady().then(resolve);
    });
  });
}

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

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startLocalServer();
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

app.on('will-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch (e) {}
  }
});
