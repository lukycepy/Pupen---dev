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
    $host = $u.Host
    if (-not $host) { return $null }
    $first = ($host -split '\.')[0]
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
  $lines = & npx supabase @allArgs 2>&1
  $exitCode = $LASTEXITCODE
  foreach ($l in $lines) { Write-Host $l }
  return @{
    ExitCode = $exitCode
    Output = ($lines -join "`n")
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$workdir = Join-Path $repoRoot 'supabase'

if (-not (Test-Path $workdir)) {
  throw "Chybi slozka supabase: $workdir"
}

$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$logFile = Join-Path $logDir ("Migrace_databaze_{0}.log" -f (Get-Date -Format 'yyyyMMdd_HHmmss'))
$latestLog = Join-Path $repoRoot 'Migrace_databaze.log'

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
  Write-Host "Supabase dir: $workdir"
  Write-Host "Linkuji projekt: $projectRef"

  $r1 = Invoke-Supabase -Workdir $workdir -Args @('link', '--project-ref', $projectRef, '--yes')
  if ($r1.ExitCode -ne 0) {
    throw 'Supabase link selhal.'
  }

  Write-Host 'Aplikuji migrace na remote DB (db push)...'
  $push = Invoke-Supabase -Workdir $workdir -Args @('db', 'push', '--linked', '--include-all', '-p', $dbPassword, '--yes')
  if ($push.ExitCode -eq 0) {
    Write-Host 'Hotovo.'
    exit 0
  }

  if ($push.Output -match 'Remote migration versions not found in local migrations directory') {
    $missing = @([regex]::Matches($push.Output, '\b\d{14}\b') | ForEach-Object { $_.Value } | Select-Object -Unique)
    if ($missing.Count -eq 0) {
      throw 'db push selhal a hlasi chybejici remote verze, ale nepodarilo se je vypsat.'
    }

    Write-Host ''
    Write-Host 'Remote DB obsahuje migration verze, ktere nejsou v lokalnim supabase/migrations:'
    $missing | ForEach-Object { Write-Host " - $_" }

    $autoRepair = $env:SUPABASE_AUTO_REPAIR_MIGRATIONS -eq '1'
    $ok = $false
    if ($autoRepair) {
      $ok = $true
    } else {
      $ans = (Read-Host 'Oznacit tyto remote verze jako reverted a pokracovat? [y/N]').Trim().ToLowerInvariant()
      $ok = $ans -eq 'y' -or $ans -eq 'yes'
    }

    if (-not $ok) {
      throw 'Zruseno. Nastav SUPABASE_AUTO_REPAIR_MIGRATIONS=1 pro automatickou opravu, nebo oprav historii rucne.'
    }

    Write-Host ''
    Write-Host 'Opravuji migration historii na remote (repair -> reverted)...'
    $repairArgs = @('migration', 'repair') + $missing + @('--status', 'reverted', '--linked', '-p', $dbPassword, '--yes')
    $repair = Invoke-Supabase -Workdir $workdir -Args $repairArgs
    if ($repair.ExitCode -ne 0) {
      throw 'migration repair selhal.'
    }

    Write-Host ''
    Write-Host 'Zkousim db push znovu...'
    $push2 = Invoke-Supabase -Workdir $workdir -Args @('db', 'push', '--linked', '--include-all', '-p', $dbPassword, '--yes')
    if ($push2.ExitCode -ne 0) {
      throw 'db push selhal i po repair.'
    }

    Write-Host 'Hotovo.'
    exit 0
  }

  throw 'db push selhal.'
} finally {
  if ($transcriptStarted) {
    try { Stop-Transcript | Out-Null } catch { }
  }
  if (Test-Path $logFile) {
    Copy-Item -Path $logFile -Destination $latestLog -Force
  }
}
