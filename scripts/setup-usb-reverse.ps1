$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
  $candidates = @()
  if ($env:ADB) {
    $candidates += $env:ADB
  }
  if ($env:LOCALAPPDATA) {
    $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe")
  }
  $candidates += "adb"

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    if ($candidate -eq "adb") {
      $cmd = Get-Command adb -ErrorAction SilentlyContinue
      if ($cmd) {
        return $cmd.Source
      }
      continue
    }
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "Could not find adb. Set `$env:ADB or install Android platform-tools."
}

$adbPath = Resolve-AdbPath
Write-Host "Using adb: $adbPath"

function Invoke-Adb {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [int]$TimeoutSeconds = 20
  )

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $adbPath
  $startInfo.Arguments = ($Args -join " ")
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
    throw "adb command timed out after ${TimeoutSeconds}s: adb $($Args -join ' ')"
  }

  $stdout = $process.StandardOutput.ReadToEnd().Trim()
  $stderr = $process.StandardError.ReadToEnd().Trim()

  if ($process.ExitCode -ne 0) {
    $details = if ($stderr) { $stderr } elseif ($stdout) { $stdout } else { "(no output)" }
    throw "adb command failed (exit $($process.ExitCode)): adb $($Args -join ' ')`n$details"
  }

  if ($stdout) {
    Write-Host $stdout
  }
}

try {
  Invoke-Adb -Args @("kill-server") -TimeoutSeconds 8
} catch {
  Write-Host "adb kill-server did not complete cleanly; continuing..."
}

Invoke-Adb -Args @("start-server") -TimeoutSeconds 45
Invoke-Adb -Args @("devices") -TimeoutSeconds 30

$reversePairs = @(
  @("tcp:8081", "tcp:8081"),
  @("tcp:19000", "tcp:19000"),
  @("tcp:19001", "tcp:19001"),
  @("tcp:8000", "tcp:8000")
)

foreach ($pair in $reversePairs) {
  Invoke-Adb -Args @("reverse", $pair[0], $pair[1]) -TimeoutSeconds 10
}

Write-Host ""
Write-Host "Active reverse mappings:"
Invoke-Adb -Args @("reverse", "--list") -TimeoutSeconds 10
Write-Host ""
Write-Host "Next steps:"
Write-Host "1) Keep backend on http://127.0.0.1:8000"
Write-Host "2) Run: npm run start:localhost:clear"
Write-Host "3) Open Expo Go with exp://127.0.0.1:8081"
