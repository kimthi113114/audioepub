# AudioEpub System Tray Runner
# Manages the Vite development server in the background and provides tray controls.

param(
    [switch]$NoOpenBrowser
)

$ErrorActionPreference = "SilentlyContinue"

# Ensure single instance of the tray app
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, "AudioEpubTrayMutex", [ref]$createdNew)
if (-not $createdNew) {
    # If already running, open the app and exit this launcher
    Start-Process "https://novel.tail356389.ts.net"
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir

# 1. Determine Port and Target URLs
$port = 5173
$localhostUrl = "http://localhost:$port"
$tailscaleDomain = "https://novel.tail356389.ts.net"
$primaryUrl = $tailscaleDomain

# Try to ensure Tailscale Serve is forwarding to port 5173
try {
    Start-Process -FilePath "tailscale" -ArgumentList "serve --bg $port" -WindowStyle Hidden -ErrorAction SilentlyContinue
} catch {}

# 2. Check if Vite/Node server is already running on port 5173
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
        [System.Windows.Forms.MessageBox]::Show("Khong the khoi dong Vite server: " + $_.Exception.Message, "AudioEpub Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        exit 1
    }
}

# 3. Create Windows Forms Application Context & NotifyIcon
$appContext = New-Object System.Windows.Forms.ApplicationContext
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon

# Load Icon from public/favicon-48.png
$iconFile = Join-Path $projectDir "public\favicon-48.png"
if (Test-Path $iconFile) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($iconFile)
        $hIcon = $bmp.GetHicon()
        $notifyIcon.Icon = [System.Drawing.Icon]::FromHandle($hIcon)
    } catch {
        $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$notifyIcon.Text = "AudioEpub (Port $port)"

# 4. Create Context Menu (Right Click on Tray Icon)
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
