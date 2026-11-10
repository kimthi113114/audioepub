const { spawn, execSync } = require('child_process');
const path = require('path');

const psScript = path.join(__dirname, 'tray.ps1');

// Spawn powershell.exe detached with hidden window
const child = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-File', psScript,
  ],
  {
    detached: true,
    stdio: 'ignore',
  }
);

child.unref();

console.log('AudioEpub is starting in system tray and browser...');

// Close the calling CMD window if launched from cmd.exe
try {
  const findCmdScript = `
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
    while ($p.ParentProcessId) {
      $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ParentProcessId)"
      if ($p.Name -ieq "cmd.exe") {
        Stop-Process -Id $p.ProcessId -Force
        break
      }
    }
  `.replace(/\r?\n/g, ' ');

  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${findCmdScript}"`, {
    stdio: 'ignore',
    timeout: 2000,
  });
} catch (_) {}

process.exit(0);
