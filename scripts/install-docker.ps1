# Official Docker Desktop installer. No standalone Engine, cleanup, or reboot.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$setupDir = Join-Path $projectRoot '.runtime\setup'
$installer = Join-Path $setupDir 'Docker Desktop Installer.exe'
$dataRoot = 'D:\DockerData\QuizOnline'
$stateFile = Join-Path $setupDir 'docker-install-state.json'
$state = [ordered]@{ startedAt = (Get-Date).ToUniversalTime().ToString('o'); status = 'checking'; backend = 'wsl-2'; dataRoot = $dataRoot; rebootRequired = $false }
function Save-State { $state | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $stateFile }
try {
    Save-State
    foreach ($existing in @("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe", 'C:\Program Files\Docker\Docker\Docker Desktop.exe')) {
        if (Test-Path -LiteralPath $existing) { $state.status = 'already-installed'; $state.executable = $existing; Save-State; exit 0 }
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $installer
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') { throw 'Installer must have a valid Docker digital signature.' }
    $state.installerVersion = (Get-Item -LiteralPath $installer).VersionInfo.ProductVersion
    if (Test-Path -LiteralPath $dataRoot) {
        if (@(Get-ChildItem -LiteralPath $dataRoot -Force).Count -gt 0) { throw 'Docker data directory is not empty. Stop without overwriting it.' }
    }
    New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
    $wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
    if (Test-Path -LiteralPath $wslConfig) {
        $state.wslConfig = 'existing-file-preserved'
    } else {
        @'
[wsl2]
memory=3GB
processors=2
swap=1GB
swapFile=D:\\DockerData\\QuizOnline\\wsl-swap.vhdx

[experimental]
autoMemoryReclaim=gradual
'@ | Set-Content -Encoding ASCII -LiteralPath $wslConfig
        $state.wslConfig = 'created: 3GB memory, 2 CPUs, 1GB swap on D, gradual memory reclaim'
    }
    $state.status = 'installing'; Save-State
    $process = Start-Process -FilePath $installer -ArgumentList @('install','--user','--quiet','--accept-license','--backend=wsl-2','--no-windows-containers',"--wsl-default-data-root=$dataRoot") -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $setupDir 'docker-install.stdout.log') -RedirectStandardError (Join-Path $setupDir 'docker-install.stderr.log')
    $state.exitCode = $process.ExitCode
    if ($process.ExitCode -in @(3010,1641)) { $state.status = 'restart-required'; $state.rebootRequired = $true; Save-State; exit 0 }
    if ($process.ExitCode -ne 0) { throw ('Docker installer failed with exit code ' + $process.ExitCode + '. Inspect installation logs.') }
    $state.status = 'installed'; Save-State
} catch {
    $state.status = 'failed'; $state.error = $_.Exception.Message; Save-State; exit 1
}
