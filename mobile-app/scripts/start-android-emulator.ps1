param(
  [string]$AvdName = "",
  [int]$BootTimeoutSeconds = 240
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AvdName) -and $env:ANDROID_EMULATOR_AVD) {
  $AvdName = $env:ANDROID_EMULATOR_AVD
}

function Resolve-ToolPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ExecutableName,
    [string[]]$CandidatePaths
  )

  foreach ($candidate in $CandidatePaths) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $command = Get-Command $ExecutableName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "Could not find $ExecutableName."
}

function Invoke-ProcessCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$ArgumentList = @(),
    [int]$TimeoutSeconds = 20
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $FilePath
  $startInfo.Arguments = ($ArgumentList -join " ")
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  $null = $process.Start()

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try {
      $process.Kill()
    } catch {
      # no-op
    }
    throw "Command timed out after ${TimeoutSeconds}s: $FilePath $($ArgumentList -join ' ')"
  }

  $stdout = $process.StandardOutput.ReadToEnd().Trim()
  $stderr = $process.StandardError.ReadToEnd().Trim()

  if ($process.ExitCode -ne 0) {
    $details = if ($stderr) { $stderr } elseif ($stdout) { $stdout } else { "(no output)" }
    throw "Command failed (exit $($process.ExitCode)): $FilePath $($ArgumentList -join ' ')`n$details"
  }

  return @{
    StdOut = $stdout
    StdErr = $stderr
  }
}

function Invoke-AdbCapture {
  param(
    [string[]]$Args,
    [int]$TimeoutSeconds = 20
  )

  return Invoke-ProcessCapture -FilePath $script:adbPath -ArgumentList $Args -TimeoutSeconds $TimeoutSeconds
}

function Get-RunningEmulatorSerial {
  $devices = Invoke-AdbCapture -Args @("devices") -TimeoutSeconds 20
  $lines = @($devices.StdOut -split "`r?`n")

  foreach ($line in $lines) {
    if ($line -match '^(emulator-\d+)\s+device$') {
      return $Matches[1]
    }
  }

  return $null
}

function Wait-ForBootComplete {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Serial,
    [int]$TimeoutSeconds = 240
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $result = Invoke-AdbCapture -Args @("-s", $Serial, "shell", "getprop", "sys.boot_completed") -TimeoutSeconds 10
      if ($result.StdOut.Trim() -eq "1") {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }

    Start-Sleep -Seconds 4
  }

  throw "Emulator $Serial did not finish booting within ${TimeoutSeconds}s."
}

$sdkRootCandidates = @(
  $env:ANDROID_SDK_ROOT,
  $env:ANDROID_HOME,
  "D:\Android\Sdk",
  (Join-Path $env:LOCALAPPDATA "Android\Sdk")
)

$emulatorPathCandidates = @()
$adbPathCandidates = @()

foreach ($sdkRoot in $sdkRootCandidates) {
  if ([string]::IsNullOrWhiteSpace($sdkRoot)) {
    continue
  }

  $emulatorPathCandidates += (Join-Path $sdkRoot "emulator\emulator.exe")
  $adbPathCandidates += (Join-Path $sdkRoot "platform-tools\adb.exe")
}

$emulatorPath = Resolve-ToolPath -ExecutableName "emulator.exe" -CandidatePaths $emulatorPathCandidates
$script:adbPath = Resolve-ToolPath -ExecutableName "adb.exe" -CandidatePaths $adbPathCandidates

Write-Host "Using emulator: $emulatorPath"
Write-Host "Using adb: $script:adbPath"

$avds = Invoke-ProcessCapture -FilePath $emulatorPath -ArgumentList @("-list-avds") -TimeoutSeconds 20
$availableAvds = @($avds.StdOut -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ([string]::IsNullOrWhiteSpace($AvdName)) {
  $preferredAvds = @(
    "SafeDriving_Pixel9_API36_1",
    "SafeDriving_Pixel9_API36",
    "SafeDriving_Pixel9_API34",
    "SafeDriving_API34"
  )

  foreach ($preferredAvd in $preferredAvds) {
    if ($availableAvds -contains $preferredAvd) {
      $AvdName = $preferredAvd
      break
    }
  }
}

if ([string]::IsNullOrWhiteSpace($AvdName) -and $availableAvds.Count -gt 0) {
  $AvdName = $availableAvds[0]
}

Write-Host "Requested AVD: $AvdName"

if ($availableAvds -notcontains $AvdName) {
  $choices = if ($availableAvds.Count -gt 0) { $availableAvds -join ", " } else { "(none found)" }
  throw "AVD '$AvdName' was not found. Available AVDs: $choices"
}

try {
  Invoke-AdbCapture -Args @("start-server") -TimeoutSeconds 30 | Out-Null
} catch {
  Write-Host "adb start-server returned a warning, continuing..."
}

$runningSerial = Get-RunningEmulatorSerial
if ($runningSerial) {
  Write-Host "Emulator already running on $runningSerial"
  Wait-ForBootComplete -Serial $runningSerial -TimeoutSeconds $BootTimeoutSeconds
  Write-Host "Emulator is ready."
  exit 0
}

Write-Host "Starting emulator '$AvdName'..."
Start-Process -FilePath $emulatorPath -ArgumentList @("-avd", $AvdName)

$launchDeadline = (Get-Date).AddSeconds(60)
$newSerial = $null
while ((Get-Date) -lt $launchDeadline) {
  $newSerial = Get-RunningEmulatorSerial
  if ($newSerial) {
    break
  }
  Start-Sleep -Seconds 3
}

if (-not $newSerial) {
  throw "The emulator process started, but no emulator device was detected within 60 seconds."
}

Write-Host "Waiting for emulator boot on $newSerial..."
Wait-ForBootComplete -Serial $newSerial -TimeoutSeconds $BootTimeoutSeconds
Write-Host "Emulator is ready."
