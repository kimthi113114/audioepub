const { exec, execSync } = require('child_process');
const path = require('path');

const psScript = path.join(__dirname, 'tray.ps1');

// Launch tray.ps1 in background completely independent of current terminal
exec(`start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${psScript}"`);

console.log('AudioEpub is starting in the system tray...');

// Close the calling cmd.exe window if launched from cmd
try {
  const findCmdScript = `
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($current.ParentProcessId)"
    while ($parent) {
      if ($parent.Name -ieq "cmd.exe") {
        Stop-Process -Id $parent.ProcessId -Force
        break
      }
      $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($parent.ParentProcessId)"
    }
  `.replace(/\r?\n/g, ' ');

  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${findCmdScript}"`, {
    stdio: 'ignore',
    timeout: 2000,
  });
} catch (_) {
  // If not in cmd or cannot kill, ignore and exit cleanly
}

process.exit(0);
