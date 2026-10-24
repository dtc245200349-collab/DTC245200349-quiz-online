# Install only Microsoft WSL prerequisites. Never reboot or install Docker here.
# Run elevated; evidence remains in the ignored .runtime/setup directory.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$setupDir = Join-Path $projectRoot '.runtime\setup'
New-Item -ItemType Directory -Force -Path $setupDir | Out-Null
$stateFile = Join-Path $setupDir 'wsl-install-state.json'
$state = [ordered]@{ startedAt = (Get-Date).ToUniversalTime().ToString('o'); status = 'checking'; rebootRequired = $false; actions = @() }
function Save-State { $state | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $stateFile }
function Feature-State([string]$name) {
    return [string](Get-WindowsOptionalFeature -Online -FeatureName $name).State
}
function Read-NativeLog([string]$file) {
    if (-not (Test-Path -LiteralPath $file)) { return '' }
    $bytes = [IO.File]::ReadAllBytes($file)
    if ($bytes.Length -gt 1 -and (($bytes[0] -eq 255 -and $bytes[1] -eq 254) -or $bytes[1] -eq 0)) {
        return [Text.Encoding]::Unicode.GetString($bytes).TrimStart([char]0xFEFF)
    }
    return [Text.Encoding]::UTF8.GetString($bytes)
}
function Invoke-Wsl([string[]]$wslArguments, [string]$label) {
    $outFile = Join-Path $setupDir ($label + '.stdout.log')
    $errFile = Join-Path $setupDir ($label + '.stderr.log')
    $wslProcess = Start-Process -FilePath "$env:WINDIR\System32\wsl.exe" -ArgumentList $wslArguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    $text = (Read-NativeLog $outFile) + (Read-NativeLog $errFile)
    $text | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $setupDir ($label + '.txt'))
    $state.actions += [ordered]@{ command = 'wsl.exe ' + ($wslArguments -join ' '); exitCode = $wslProcess.ExitCode; log = $label + '.txt' }
    Save-State
    return [pscustomobject]@{ ExitCode = $wslProcess.ExitCode; Text = $text }
}
try {
    Save-State
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Open PowerShell as Administrator to run this installer.' }
    $os = Get-CimInstance Win32_OperatingSystem
    $system = Get-CimInstance Win32_ComputerSystem
    $ram = (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum
    $systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'"
    $state.preflight = [ordered]@{ windows = $os.Caption; build = $os.BuildNumber; ramGiB = $ram / 1GB; freeSystemDriveGiB = [math]::Round($systemDrive.FreeSpace / 1GB, 2); hypervisorPresent = $system.HypervisorPresent }
    if ([int]$os.BuildNumber -lt 22631 -or -not [Environment]::Is64BitOperatingSystem) { throw 'Windows build/architecture does not meet the selected Docker Desktop baseline.' }
    if ($ram -lt 8GB) { throw 'Docker Desktop requires at least 8 GB installed RAM.' }
    if ($systemDrive.FreeSpace -lt 15GB) { throw 'Less than 15 GB free on system drive; stop before installation.' }
    $processors = @(Get-CimInstance Win32_Processor)
    if (-not $system.HypervisorPresent -and -not ($processors | Where-Object { $_.VirtualizationFirmwareEnabled -and $_.SecondLevelAddressTranslationExtensions })) { throw 'Hardware virtualization/SLAT could not be confirmed; check BIOS before installing.' }
    $state.featuresBefore = [ordered]@{ VirtualMachinePlatform = (Feature-State 'VirtualMachinePlatform'); WSL = (Feature-State 'Microsoft-Windows-Subsystem-Linux') }
    if (($state.featuresBefore.Values -contains 'EnablePending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) {
        $state.status = 'restart-required-before-install'; $state.rebootRequired = $true; Save-State; exit 0
    }
    $state.status = 'installing-wsl'; Save-State
    # Official Microsoft command; do not add an unrelated distribution or start it.
    $result = Invoke-Wsl -wslArguments @('--install', '--no-distribution', '--web-download') -label 'wsl-install'
    $state.featuresAfter = [ordered]@{ VirtualMachinePlatform = (Feature-State 'VirtualMachinePlatform'); WSL = (Feature-State 'Microsoft-Windows-Subsystem-Linux') }
    $needsRestart = ($result.ExitCode -in @(3010,1641)) -or ($state.featuresAfter.Values -contains 'EnablePending') -or (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or ($result.Text -match '(?i)(reboot|restart).*(required|necessary|take effect)|until.*(reboot|restart)|changes will.*(reboot|restart)')
    if ($needsRestart) {
        $state.status = 'restart-required'; $state.rebootRequired = $true; Save-State; exit 0
    }
    if ($result.ExitCode -ne 0) { throw ('WSL installation failed, exit code ' + $result.ExitCode + '. Read .runtime/setup/wsl-install.txt.') }
    $version = Invoke-Wsl -wslArguments @('--version') -label 'wsl-version'
    if ($version.ExitCode -ne 0) { throw 'WSL version verification failed; see the saved log.' }
    $state.status = 'wsl-installed'; Save-State
} catch {
    $state.status = 'failed'; $state.error = $_.Exception.Message; Save-State; exit 1
}
