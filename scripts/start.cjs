const { spawn } = require('child_process');
const path = require('path');

const psScript = path.join(__dirname, 'tray.ps1');

// Spawn detached powershell via Windows start command
const child = spawn(
  'cmd.exe',
  [
    '/c',
    'start',
    '""',
    'powershell.exe',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-WindowStyle',
    'Hidden',
    '-File',
    psScript,
  ],
  {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }
);

child.unref();

console.log('AudioEpub is starting in system tray and browser...');
process.exit(0);
