# AudioEpub System Tray Runner
# Manages the Vite development server in the background, shows tray icon, and opens app in browser.

param(
    [switch]$NoOpenBrowser
)

$ErrorActionPreference = "SilentlyContinue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

# 1. Determine Port and Target URLs
$port = 5173
$localhostUrl = "http://localhost:$port"
$tailscaleDomain = "https://novel.tail356389.ts.net"
$primaryUrl = $tailscaleDomain

# Ensure Tailscale Serve is forwarding to port 5173
try {
    Start-Process -FilePath "tailscale" -ArgumentList "serve --bg $port" -WindowStyle Hidden -ErrorAction SilentlyContinue
} catch {}

# 2. Check if a Tray instance is already running
$runningTray = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*tray.ps1*" -and $_.ProcessId -ne $PID
}
if ($runningTray) {
    # Tray is already running! Just open the browser and exit this duplicate script
    Start-Process $primaryUrl
    exit 0
}

# 3. Check if Vite/Node server is already running on port 5173
$serverProcess = $null
try {
    $existingConn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingConn) {
        $serverProcess = Get-Process -Id $existingConn.OwningProcess -ErrorAction SilentlyContinue
    }
} catch {}

if (-not $serverProcess) {
    # Start Vite in background (no console window)
    $viteBin = Join-Path $projectDir "node_modules\vite\bin\vite.js"
    $nodeExe = "node.exe"
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd -and $nodeCmd.Source) {
        $nodeExe = $nodeCmd.Source
    }
    
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = $nodeExe
    $pinfo.Arguments = "`"$viteBin`""
    $pinfo.WorkingDirectory = $projectDir
    $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $pinfo.CreateNoWindow = $true
    $pinfo.UseShellExecute = $false
    
    try {
        $serverProcess = [System.Diagnostics.Process]::Start($pinfo)
    } catch {
        # Fallback using Start-Process
        $serverProcess = Start-Process -FilePath $nodeExe -ArgumentList "`"$viteBin`"" -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru
    }
    
    # Wait up to 3 seconds for port 5173 to be ready
    for ($i = 0; $i -lt 6; $i++) {
        Start-Sleep -Milliseconds 500
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) { break }
    }
}

# 4. Open the App in the user's default browser on startup!
if (-not $NoOpenBrowser) {
    try {
        Start-Process $primaryUrl
    } catch {
        Start-Process $localhostUrl
    }
}

# 5. Create Windows Forms Application Context & NotifyIcon
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$appContext = New-Object System.Windows.Forms.ApplicationContext
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon

# Load Icon from public/favicon.ico
$icoFile = Join-Path $projectDir "public\favicon.ico"
if (Test-Path $icoFile) {
    try {
        $notifyIcon.Icon = New-Object System.Drawing.Icon($icoFile)
    } catch {
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$notifyIcon.Text = "AudioEpub (Port $port)"

# 6. Create Context Menu (Right Click on Tray Icon)
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# Menu Item: Status
$titleItem = $contextMenu.Items.Add("[AudioEpub] Dang chay")
$titleItem.Enabled = $false
$titleFont = New-Object System.Drawing.Font($titleItem.Font, [System.Drawing.FontStyle]::Bold)
$titleItem.Font = $titleFont

$contextMenu.Items.Add("-") | Out-Null

# Menu Item: Open via Tailscale
$openTailscaleItem = $contextMenu.Items.Add("Mo AudioEpub (Tailscale HTTPS)")
$openTailscaleItem.add_Click({
    Start-Process $tailscaleDomain
})
$openTailscaleItem.Font = New-Object System.Drawing.Font($openTailscaleItem.Font, [System.Drawing.FontStyle]::Bold)

# Menu Item: Open via Localhost
$openLocalhostItem = $contextMenu.Items.Add("Mo AudioEpub (Localhost:5173)")
$openLocalhostItem.add_Click({
    Start-Process $localhostUrl
})

# Menu Item: Copy Link
$copyLinkItem = $contextMenu.Items.Add("Sao chep link Tailscale")
$copyLinkItem.add_Click({
    [System.Windows.Forms.Clipboard]::SetText($tailscaleDomain)
    $notifyIcon.ShowBalloonTip(2000, "AudioEpub", "Da sao chep link Tailscale", [System.Windows.Forms.ToolTipIcon]::Info)
})

$contextMenu.Items.Add("-") | Out-Null

# Menu Item: Exit / Stop App
$exitItem = $contextMenu.Items.Add("Tat app (Thoat hoan toan)")
$exitItem.add_Click({
    # Stop Vite/Node server
    try {
        if ($serverProcess -and -not $serverProcess.HasExited) {
            $serverProcess.Kill()
        }
    } catch {}

    # Ensure any remaining node process on port 5173 is stopped
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    # Remove Tray Icon & Exit
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    $appContext.ExitThread()
    [System.Windows.Forms.Application]::Exit()
    [System.Environment]::Exit(0)
})

$notifyIcon.ContextMenuStrip = $contextMenu
$notifyIcon.Visible = $true

# Double-click tray icon to open primary URL
$notifyIcon.add_DoubleClick({
    Start-Process $primaryUrl
})

# Show startup notification balloon tip
$notifyIcon.ShowBalloonTip(
    4000,
    "AudioEpub dang chay!",
    "Ung dung da san sang tai $primaryUrl`nNhap dup chuot de Mo, chuot phai de Tat app.",
    [System.Windows.Forms.ToolTipIcon]::Info
)

# Run Windows message loop
[System.Windows.Forms.Application]::Run($appContext)
