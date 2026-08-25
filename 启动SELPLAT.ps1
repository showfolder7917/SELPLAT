param(
    [switch]$ValidateOnly
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$platformRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$requiredDirs = @("apps", "shared", "docs", "cache")
foreach ($requiredDir in $requiredDirs) {
    $targetPath = Join-Path $platformRoot $requiredDir
    if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
        Write-Error ("Missing platform directory: " + $requiredDir)
    }
}

$hostBackend = Join-Path $platformRoot "apps\host\backend"
if (-not (Test-Path -LiteralPath $hostBackend -PathType Container)) {
    Write-Error "Missing Host backend directory: apps/host/backend"
}

$hostBuildFile = Join-Path $hostBackend "build.gradle"
if (-not (Test-Path -LiteralPath $hostBuildFile -PathType Leaf)) {
    Write-Error "Missing Host build entry: apps/host/backend/build.gradle"
}

$settingsFile = Join-Path $platformRoot "settings.gradle"
if (-not (Test-Path -LiteralPath $settingsFile -PathType Leaf)) {
    Write-Error "Missing Gradle project registry: settings.gradle"
}

$gradleWrapper = Join-Path $platformRoot "gradlew.bat"
if (-not (Test-Path -LiteralPath $gradleWrapper -PathType Leaf)) {
    Write-Error "Missing Gradle wrapper: gradlew.bat"
}

Write-Output "SELPLAT platform startup validation passed."
Write-Output ("Platform root: " + $platformRoot)
Write-Output "Runtime project: apps/host/backend and its explicit Gradle dependencies"
Write-Output "Excluded application: apps/ai-desktop"

if ($ValidateOnly) {
    Write-Output "Validation-only mode completed; SELPLAT was not started."
    exit 0
}

$hostPort = 8080
$existingListeners = @(Get-NetTCPConnection -LocalPort $hostPort -State Listen -ErrorAction SilentlyContinue)
$existingProcessIds = @($existingListeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($existingProcessId in $existingProcessIds) {
    Write-Output ("Stopping existing process on SELPLAT port " + $hostPort + ": " + $existingProcessId)
    Stop-Process -Id $existingProcessId -Force
}

Write-Output "Starting the SELPLAT platform runtime."
Write-Output ("Health: http://localhost:" + $hostPort + "/api/platform/runtime/health")
Set-Location $platformRoot
& $gradleWrapper --offline --no-daemon :apps:host:backend:run
exit $LASTEXITCODE
