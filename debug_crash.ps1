# Debug Crash Script for Map View
# This script captures crash logs when you click "View Map"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Map Crash Debug Tool" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if ADB is installed
Write-Host "Checking if ADB is installed..." -ForegroundColor Yellow
try {
    $adbVersion = adb version 2>&1
    if ($LASTEXITCODE -ne 0 -or $adbVersion -like "*not recognized*") {
        throw "ADB not found"
    }
    Write-Host "✓ ADB found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: ADB is not installed or not in PATH!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install ADB:" -ForegroundColor Yellow
    Write-Host "  1. Download Platform Tools: https://developer.android.com/tools/releases/platform-tools" -ForegroundColor White
    Write-Host "  2. Extract to C:\Android\platform-tools (or any folder)" -ForegroundColor White
    Write-Host "  3. Add to PATH: Win+X → System → Advanced → Environment Variables → Path" -ForegroundColor White
    Write-Host "  4. Restart PowerShell and try again" -ForegroundColor White
    Write-Host ""
    Write-Host "Or see: DriverMobileApp\ADB_SETUP_WINDOWS.md for detailed instructions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Alternative: Use in-app crash logs (Settings → View Crash Logs)" -ForegroundColor Yellow
    exit 1
}

# Check if device is connected
Write-Host "Checking for connected Android device..." -ForegroundColor Yellow
try {
    $devices = adb devices 2>&1 | Select-String -Pattern "device$"

if ($devices.Count -eq 0) {
    Write-Host "ERROR: No Android device found!" -ForegroundColor Red
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "  1. Enable USB Debugging on your device" -ForegroundColor Yellow
    Write-Host "  2. Connect device via USB" -ForegroundColor Yellow
    Write-Host "  3. Run: adb devices" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Device connected: $($devices[0])" -ForegroundColor Green
Write-Host ""

# Clear old logs
Write-Host "Clearing old logs..." -ForegroundColor Yellow
adb logcat -c
Write-Host "✓ Logs cleared" -ForegroundColor Green
Write-Host ""

# Create log file with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile = "crash_debug_$timestamp.txt"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "READY TO CAPTURE LOGS" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "  1. Open your app on the device" -ForegroundColor White
Write-Host "  2. Click 'View Map' button" -ForegroundColor White
Write-Host "  3. Watch for errors in this window" -ForegroundColor White
Write-Host "  4. Press Ctrl+C to stop after capturing the crash" -ForegroundColor White
Write-Host ""
Write-Host "Logs will be saved to: $logFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting log capture..." -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Start capturing logs
# Filter for errors, React Native, and map-related logs
adb logcat -v time *:E ReactNativeJS:V ReactNative:V AndroidRuntime:E | Tee-Object -FilePath $logFile | Select-String -Pattern "FATAL|Error|Exception|MapView|react-native-maps|ReactNativeJS|AndroidRuntime" -Context 2,5

