$ErrorActionPreference = 'Stop'

function Ensure-NodeInPath {
  if (Get-Command node -ErrorAction SilentlyContinue) { return }
  $nodeDir = 'C:\Program Files\nodejs'
  if (Test-Path $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
  }
}

function Read-FileText {
  param([Parameter(Mandatory)] [string] $Path)
  if (-not (Test-Path $Path)) { return $null }
  $raw = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
  if (-not $raw) { return $null }
  return $raw.TrimStart([char]0xFEFF)
}

function Get-ProjectRefFromDotEnv {
  param([Parameter(Mandatory)] [string] $RepoRoot)

  $envPath = Join-Path $RepoRoot '.env'
  $raw = Read-FileText -Path $envPath
  if (-not $raw) { return $null }

  $m = [regex]::Match($raw, '(?m)^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$', [Text.RegularExpressions.RegexOptions]::None)
  if (-not $m.Success) { return $null }
  $url = $m.Groups[1].Value.Trim().Trim('"').Trim("'")
  if (-not $url) { return $null }

  try {
    $u = [Uri]$url
    $urlHost = $u.Host
    if (-not $urlHost) { return $null }
    $first = ($urlHost -split '\.')[0]
    if ($first) { return $first }
  } catch {
  }

  $m2 = [regex]::Match($url, 'https?://([a-z0-9]+)\.supabase\.co', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m2.Success) { return $m2.Groups[1].Value }

  return $null
}

function Get-DbPassword {
  $dbPassword = $env:SUPABASE_DB_PASSWORD
  if ($dbPassword) { return $dbPassword }

  $secure = Read-Host 'Zadej DB heslo (nezobrazuje se)' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Invoke-Supabase {
  param(
    [Parameter(Mandatory)] [string] $Workdir,
    [Parameter(Mandatory)] [string[]] $Args
  )

  $allArgs = @('--workdir', $Workdir) + $Args
  $prevEap = $ErrorActionPreference
  $errCountBefore = $global:Error.Count
  $ErrorActionPreference = 'SilentlyContinue'

  try {
    try {
      $lines = & npx supabase @allArgs 2>&1
      $exitCode = $LASTEXITCODE
    } catch {
      $lines = @("Invoke-Supabase failed: $($_.Exception.Message)")
      $exitCode = 1
    }
  } finally {
    $ErrorActionPreference = $prevEap
    while ($global:Error.Count -gt $errCountBefore) {
      $global:Error.RemoveAt(0)
    }
  }

  foreach ($l in $lines) { Write-Host $l }
  return @{
    ExitCode = $exitCode
    Output = ($lines -join "`n")
  }
}

function Get-MissingRemoteMigrationsFromTable {
  param([Parameter(Mandatory)] [string] $Text)
  $missing = @()
  foreach ($line in ($Text -split "`r?`n")) {
    $m = [regex]::Match($line, '^\s*(\d{14})\s*\|\s*([0-9]{14})?\s*\|')
    if (-not $m.Success) { continue }
    $local = $m.Groups[1].Value
    $remote = $m.Groups[2].Value
    if ($local -and (-not $remote)) { $missing += [string]$local }
  }
  return $missing | Select-Object -Unique | Sort-Object
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$supabaseDir = Join-Path $repoRoot 'supabase'
if (-not (Test-Path $supabaseDir)) {
  throw "Chybi slozka supabase: $supabaseDir"
}

$migrationsDir = Join-Path $supabaseDir 'migrations'
if (-not (Test-Path $migrationsDir)) {
  throw "Chybi slozka supabase\\migrations: $migrationsDir"
}

$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ("Migrace_databaze_{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$latestLog = Join-Path $PSScriptRoot 'Migrace_databaze.latest.log'

Ensure-NodeInPath
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw 'npx nebylo nalezeno. Nainstaluj Node.js (obsahuje npm/npx) nebo pridej do PATH.'
}

$projectRef = $env:SUPABASE_PROJECT_REF
if (-not $projectRef) {
  $projectRef = Get-ProjectRefFromDotEnv -RepoRoot $repoRoot
}
if (-not $projectRef) {
  $projectRef = Read-Host 'Zadej Supabase project ref (napr. ojnpqxfaiuyfpsogthhx)'
}
if (-not $projectRef) {
  throw 'Chybi Supabase project ref.'
}

$dbPassword = Get-DbPassword
if (-not $dbPassword) {
  throw 'Chybi DB heslo.'
}

$transcriptStarted = $false
try {
  Start-Transcript -Path $logFile -Force | Out-Null
  $transcriptStarted = $true

  Write-Host "Repo: $repoRoot"
  Write-Host "Supabase dir: $supabaseDir"
  Write-Host "Linkuji projekt: $projectRef"

  $link = Invoke-Supabase -Workdir $repoRoot -Args @('link', '--project-ref', $projectRef, '--yes')
  if ($link.ExitCode -ne 0) {
    throw "Supabase link selhal.`n$($link.Output)"
  }

  Write-Host 'Aplikuji migrace na remote DB (db push)...'
  $push = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'push', '--linked', '--include-all', '-p', $dbPassword, '--yes')
  if ($push.ExitCode -ne 0) {
    throw "db push selhal (ExitCode=$($push.ExitCode)).`n$($push.Output)"
  }

  Write-Host ''
  Write-Host 'Kontroluji stav migraci (migration list --linked)...'
  $list = Invoke-Supabase -Workdir $repoRoot -Args @('migration', 'list', '--linked', '-p', $dbPassword)
  if ($list.ExitCode -ne 0) {
    throw "migration list selhal.`n$($list.Output)"
  }

  $missing = Get-MissingRemoteMigrationsFromTable -Text $list.Output
  if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'Remote DB je stale pozadu. Chybi tyto migrace:'
    $missing | ForEach-Object { Write-Host " - $_" }
    throw 'Remote migration list ukazuje chybejici migrace po db push.'
  }

  Write-Host ''
  Write-Host 'Hotovo.'
  exit 0
} catch {
  Write-Host ''
  Write-Host "CHYBA: $($_.Exception.Message)"
  throw
} finally {
  if ($transcriptStarted) {
    try { Stop-Transcript | Out-Null } catch { }
  }
  if (Test-Path $logFile) {
    Copy-Item -Path $logFile -Destination $latestLog -Force
  }
}

