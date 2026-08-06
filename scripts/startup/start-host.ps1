param(
    [switch]$ValidateOnly
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$platformRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path

$requiredDirs = @("apps", "shared", "docs", "scripts", "cache", "package-meta")
foreach ($requiredDir in $requiredDirs) {
    $targetPath = Join-Path $platformRoot $requiredDir
    if (-not (Test-Path -Path $targetPath -PathType Container)) {
        Write-Error ("Missing platform directory: " + $requiredDir)
    }
}

$moduleMetaDir = Join-Path $platformRoot "package-meta\modules"
if (-not (Test-Path -Path $moduleMetaDir -PathType Container)) {
    Write-Error "Missing module metadata directory: package-meta/modules"
}

$moduleFiles = @(Get-ChildItem -Path $moduleMetaDir -Filter "*.json" | Sort-Object Name)
if ($moduleFiles.Count -eq 0) {
    Write-Error "No module metadata files were found."
}

$enabledModules = @()
$allModules = @()

foreach ($moduleFile in $moduleFiles) {
    $moduleMeta = Get-Content -Path $moduleFile.FullName -Encoding UTF8 | ConvertFrom-Json
    $allModules += [string]$moduleMeta.module_id
    $moduleEnabled = [bool]$moduleMeta.enabled

    $manifestRelativePath = [string]$moduleMeta.manifest_path
    $manifestFullPath = Join-Path $platformRoot $manifestRelativePath
    if (-not (Test-Path -Path $manifestFullPath -PathType Leaf)) {
        if ($moduleEnabled) {
            Write-Error ("Enabled module [" + $moduleMeta.module_id + "] is missing manifest file: " + $manifestRelativePath)
        }
        Write-Warning ("Disabled module [" + $moduleMeta.module_id + "] has no manifest and will be skipped: " + $manifestRelativePath)
        continue
    }

    $manifestData = Get-Content -Path $manifestFullPath -Encoding UTF8 | ConvertFrom-Json
    if ([string]$manifestData.module_id -ne [string]$moduleMeta.module_id) {
        Write-Error ("Module [" + $moduleMeta.module_id + "] has mismatched manifest.module_id.")
    }

    if ($moduleEnabled) {
        $enabledModules += [string]$moduleMeta.module_id
    }
}

if (-not ($enabledModules -contains "host")) {
    Write-Error "Minimal startup validation failed: host module is not enabled."
}

$allModulesText = ($allModules | Sort-Object) -join ", "
$enabledModulesText = ($enabledModules | Sort-Object) -join ", "

Write-Output "SELPLAT minimal startup validation passed."
Write-Output ("Platform root: " + $platformRoot)
Write-Output ("All modules: " + $allModulesText)
Write-Output ("Enabled modules: " + $enabledModulesText)

if ($ValidateOnly) {
    Write-Output "Validation-only mode completed; platform-runtime was not started."
    exit 0
}

$hostPort = 8080
$existingListeners = @(Get-NetTCPConnection -LocalPort $hostPort -State Listen -ErrorAction SilentlyContinue)
foreach ($existingListener in $existingListeners) {
    $existingProcessId = [int]$existingListener.OwningProcess
    Write-Output ("Stopping existing process on platform-runtime port " + $hostPort + ": " + $existingProcessId)
    Stop-Process -Id $existingProcessId -Force
}

$gradleWrapper = Join-Path $platformRoot "gradlew.bat"
if (-not (Test-Path -LiteralPath $gradleWrapper -PathType Leaf)) {
    Write-Error "Missing Gradle wrapper: gradlew.bat"
}

Write-Output "Starting SELPLAT platform-runtime."
Write-Output "Project: apps/host/backend"
Write-Output ("Health: http://localhost:" + $hostPort + "/api/platform/runtime/health")
Set-Location $platformRoot
& $gradleWrapper --offline --no-daemon :apps:host:backend:run
exit $LASTEXITCODE
