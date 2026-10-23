# $ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Get-DefaultSupabaseProjectUrl {
  return 'https://aakbezmiacnwxzdutxjw.supabase.co'
}

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

function Parse-DotEnvRaw {
  param([Parameter(Mandatory)] [string] $Raw)
  $result = @{}
  foreach ($line in ($Raw -split "`r?`n")) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t.StartsWith('#')) { continue }
    $m = [regex]::Match($t, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not $m.Success) { continue }
    $k = $m.Groups[1].Value
    $v = $m.Groups[2].Value.Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k) { $result[$k] = $v }
  }
  return $result
}

function Load-DotEnvIntoProcess {
  param([Parameter(Mandatory)] [string] $RepoRoot)

  $envLayers = @('.env', '.env.local', '.env.production', '.env.production.local', '.env.staging', '.env.staging.local')
  $merged = @{}

  foreach ($fname in $envLayers) {
    $envPath = Join-Path $RepoRoot $fname
    $raw = Read-FileText -Path $envPath
    if (-not $raw) { continue }
    $parsed = Parse-DotEnvRaw -Raw $raw
    foreach ($k in $parsed.Keys) {
      $merged[$k] = $parsed[$k]
    }
  }

  foreach ($k in $merged.Keys) {
    if (Test-Path "Env:$k") { continue }
    $v = $merged[$k]
    if ($k -and $v -ne $null) { Set-Item -Path "Env:$k" -Value $v }
  }
}

function Get-ProjectRefFromUrl {
  param([Parameter(Mandatory)] [string] $Url)
  try {
    $u = [Uri]$Url
    $h = $u.Host
    if (-not $h) { return $null }
    $first = ($h -split '\.')[0]
    if ($first) { return $first }
  } catch {
  }
  $m = [regex]::Match($Url, 'https?://([a-z0-9]+)\.supabase\.co', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

function Get-ProjectRefFromDbUrl {
  param([Parameter(Mandatory)] [string] $DbUrl)
  $m = [regex]::Match($DbUrl, '@db\.([a-z0-9]+)\.supabase\.co[:/]', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m.Success) { return $m.Groups[1].Value }
  $m2 = [regex]::Match($DbUrl, 'postgresql://[^:]+:[^@]+@([a-z0-9.-]+)[:/]', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($m2.Success) {
    $hostPart = $m2.Groups[1].Value
    $parts = $hostPart -split '\.'
    foreach ($p in $parts) {
      if ($p -and $p.Length -eq 20 -and [regex]::IsMatch($p, '^[a-z0-9]+$')) { return $p }
    }
  }
  return $null
}

function Get-ProjectRefFromDotEnv {
  param([Parameter(Mandatory)] [string] $RepoRoot)

  $envLayers = @('.env.local', '.env.production.local', '.env.staging.local', '.env.production', '.env.staging', '.env')
  foreach ($fname in $envLayers) {
    $envPath = Join-Path $RepoRoot $fname
    $raw = Read-FileText -Path $envPath
    if (-not $raw) { continue }

    $mDb = [regex]::Match($raw, '(?m)^\s*DATABASE_URL\s*=\s*(.+?)\s*$', [Text.RegularExpressions.RegexOptions]::None)
    if ($mDb.Success) {
      $dbUrl = $mDb.Groups[1].Value.Trim().Trim('"').Trim("'")
      if ($dbUrl) {
        $ref = Get-ProjectRefFromDbUrl -DbUrl $dbUrl
        if ($ref) { return $ref }
      }
    }

    $mUrl = [regex]::Match($raw, '(?m)^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$', [Text.RegularExpressions.RegexOptions]::None)
    if (-not $mUrl.Success) { continue }
    $url = $mUrl.Groups[1].Value.Trim().Trim('"').Trim("'")
    if (-not $url) { continue }

    try {
      $u = [Uri]$url
      $urlHost = $u.Host
      if (-not $urlHost) { continue }
      $first = ($urlHost -split '\.')[0]
      if ($first) { return $first }
    } catch {
    }

    $m2 = [regex]::Match($url, 'https?://([a-z0-9]+)\.supabase\.co', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($m2.Success) { return $m2.Groups[1].Value }
  }

  return $null
}

function Get-PasswordFromDbUrl {
  param([Parameter(Mandatory)] [string] $DbUrl)
  $m = [regex]::Match($DbUrl, '^postgresql://[^:]+:([^@]+)@', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $m.Success) { return $null }
  $pwdRaw = $m.Groups[1].Value
  try {
    return [Uri]::UnescapeDataString($pwdRaw)
  } catch {
    return $pwdRaw
  }
}

function Get-DbPassword {
  $dbPassword = $env:SUPABASE_DB_PASSWORD
  if ($dbPassword) {
    Write-Host 'DB heslo: pouzivam SUPABASE_DB_PASSWORD z prostredi/.env.local/.env.'
    return $dbPassword
  }

  $dbPasswordAlt = $env:Supabase_database_password
  if ($dbPasswordAlt) {
    Write-Host 'DB heslo: pouzivam Supabase_database_password z prostredi.'
    return $dbPasswordAlt
  }

  $dbUrl = $env:DATABASE_URL
  if ($dbUrl) {
    $fromUrl = Get-PasswordFromDbUrl -DbUrl $dbUrl
    if ($fromUrl) {
      Write-Host 'DB heslo: extrahovano z DATABASE_URL v .env/.env.local.'
      return $fromUrl
    }
  }

  $secretsPath = Join-Path $PSScriptRoot '.db_password.dpapi'
  if (Test-Path $secretsPath) {
    try {
      $enc = ((Get-Content -LiteralPath $secretsPath -Raw -ErrorAction SilentlyContinue) | ForEach-Object { $_.Trim() })
      if ($enc) {
        $sec = ConvertTo-SecureString $enc -ErrorAction Stop
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
        try {
          $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
          if ($plain) {
            Write-Host "DB heslo: nacteno z $secretsPath."
            return $plain
          }
        } finally {
          [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
      }
    } catch {
      Write-Host "DB heslo: nepodarilo se nacist z $secretsPath ($($_.Exception.Message))."
      try { Remove-Item -LiteralPath $secretsPath -Force -ErrorAction SilentlyContinue } catch { }
    }
  }

  $secure = Read-Host 'Zadej DB heslo (nezobrazuje se)' -AsSecureString
  try {
    $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $secretsPath -Encoding ascii -NoNewline
    Write-Host "DB heslo: ulozeno do $secretsPath."
  } catch {
    Write-Host "DB heslo: nepodarilo se ulozit do $secretsPath ($($_.Exception.Message))."
  }
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
      $safeArgs = @()
      for ($i = 0; $i -lt $allArgs.Count; $i++) {
        $a = [string]$allArgs[$i]
        if (($a -eq '-p' -or $a -eq '--password' -or $a -eq '--db-url') -and ($i + 1) -lt $allArgs.Count) {
          $safeArgs += $a
          $safeArgs += '***'
          $i++
          continue
        }
        $safeArgs += $a
      }

      Write-Host ''
      Write-Host ('> npx supabase ' + ($safeArgs -join ' '))

      $lines = & npx supabase @allArgs 2>&1
      $exitCode = $LASTEXITCODE
      foreach ($l in $lines) { if ($l -ne $null) { Write-Host $l } }
    } catch {
      $lines = @("Invoke-Supabase failed: $($_.Exception.Message)")
      $exitCode = 1
    }
  } finally {
    $ErrorActionPreference = $prevEap
    $added = $global:Error.Count - $errCountBefore
    if ($added -gt 0) {
      $nativeErrors = @()
      for ($i = 0; $i -lt $added; $i++) {
        $nativeErrors += [string]$global:Error[$i]
      }
      foreach ($ne in $nativeErrors) {
        if ($ne) { Write-Host $ne }
      }
      $lines = @($lines) + $nativeErrors
    }

    while ($global:Error.Count -gt $errCountBefore) { $global:Error.RemoveAt(0) }
  }

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

function Get-EncodedRemoteDbUrl {
  param(
    [Parameter(Mandatory)] [string] $ProjectRef,
    [Parameter(Mandatory)] [string] $DbPassword
  )

  $dbHost = "db.$ProjectRef.supabase.co"
  $pwdEscapedForUri = [Uri]::EscapeDataString($DbPassword)
  return "postgresql://postgres:$pwdEscapedForUri@$($dbHost):5432/postgres?sslmode=require"
}

function Cleanup-OldLogs {
  param(
    [Parameter(Mandatory)] [string] $LogDir,
    [Parameter(Mandatory)] [int] $KeepLast
  )

  try {
    $files = Get-ChildItem -LiteralPath $LogDir -File -Filter 'Migrace_databaze_*.log' -ErrorAction SilentlyContinue |
      Sort-Object -Property LastWriteTime -Descending
    if (-not $files) { return }

    $toDelete = $files | Select-Object -Skip $KeepLast
    foreach ($f in $toDelete) {
      try { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue } catch { }
    }
  } catch { }
}

function Format-DbAuthHint {
  param(
    [Parameter(Mandatory)] [string] $OutputText,
    [string] $UsingMode = '',
    [string[]] $TriedUrls = @(),
    [string] $ProjectRef = ''
  )
  $hint = ''
  if ($TriedUrls -and $TriedUrls.Count -gt 0) {
    $hint += "`n   -> Vyzkousel jsem nasledujici URL (bez hesla):"
    foreach ($u in $TriedUrls) {
      $safe = [regex]::Replace($u, '(postgresql://[^:]+:)[^@]+(@)', '${1}***${2}')
      $hint += "`n      - $safe"
    }
  }
  if ($OutputText -match '28P01' -or $OutputText -match 'password authentication failed') {
    $hint += "`n"
    $hint += "`n ==============================================================================="
    $hint += "`n  | DUVOD SELHANI (28P01 password authentication failed)                      |"
    $hint += "`n  |                                                                             |"
    $hint += "`n  | db query --linked: OK (nepouziva pooler, jde pres REST API, overi jen token|"
    $hint += "`n  | db push --linked : SELHA (pouziva SKUTECNE PostgreSQL pooler pripojeni a   |"
    $hint += "`n  |                     overi DB heslo. Tim se ukazuje, ze heslo neni spravne). |"
    $hint += "`n  |                                                                             |"
    $hint += "`n  | Pouzity rezim: $($UsingMode.PadRight(56).Substring(0,[Math]::Min(56,$UsingMode.Length))) |"
    $hint += "`n  |                                                                             |"
    $hint += "`n  | Nejčastější příčina: SUPABASE_DB_PASSWORD / DATABASE_URL v .env.local   |"
    $hint += "`n  | obsahuje project-ref nebo heslo z JINEHO Supabase projektu.             |"
    $hint += "`n  |                                                                             |"
    if ($ProjectRef) {
      $hint += "`n  | RESENI (3 kroky):                                                           |"
      $hint += "`n  |                                                                             |"
      $hint += "`n  |  1. Otevři nastavení DB hesla:                                              |"
      $hint += "`n  |     https://supabase.com/dashboard/project/$ProjectRef/settings/database    |"
      $hint += "`n  |                                                                             |"
      $hint += "`n  |  2. Sekce Database password:                                                |"
      $hint += "`n  |     - bud ZOBRAZ a zkopíruj EXISTUJÍCÍ heslo (pokud ho znáš)                |"
      $hint += "`n  |     - nebo klikni na 'Reset database password' a zvol NOVE heslo            |"
      $hint += "`n  |                                                                             |"
      $hint += "`n  |  3. Ulož do .env.local DVA radky se STEJNYM heslem:                         |"
      $hint += "`n  |     SUPABASE_DB_PASSWORD=""tvoje_nove_heslo""                                |"
      $hint += "`n  |     DATABASE_URL=""postgresql://postgres:tvoje_nove_heslo@X:5432/postgres"" |"
      $hint += "`n ==============================================================================="
      $hint += "`n"
    } else {
      $hint += "`n   -> RESENI 1: Over ze .env.local ma radek SUPABASE_DB_PASSWORD=""SKUTECNE_HESLO"" (s uvozovkami pokud obsahuje specialni znaky)."
      $hint += "`n   -> RESENI 2: Heslo si zobraz a prip. zresetuj v: Supabase Dashboard -> Project Settings -> Database -> Database password."
      $hint += "`n   -> RESENI 3: Pokud jsi heslo zmenil, zmen ho i v .env.local (DATABASE_URL i SUPABASE_DB_PASSWORD)."
    }
    $hint += "`n   -> POZNAMKA: Uzivatel pro pripojeni muze byt 'postgres' nebo 'postgres.<project-ref>' dle infrakstruktury; heslo je ale stejne pro oba."
  }
  if ($OutputText -match 'no such host' -or $OutputText -match 'hostname resolving error') {
    $hint += "`n   -> DUVOD: Hostitel v DATABASE_URL neexistuje v DNS. Pouzity format je pravdepodobne spatny pro tento typ Supabase projektu."
    $hint += "`n   -> RESENI: Skript se nyni pokousi automaticky odvodit spravny format z --linked debug vystupu (infra detekce)."
  }
  if ($OutputText -match 'Connect to your database by setting the env var correctly') {
    $hint += "`n   -> DUVOD: Supabase CLI nenasel SUPABASE_DB_PASSWORD / --db-url parametr neni platny."
  }
  if ($OutputText -match 'project ref' -or $OutputText -match 'not found' -or $OutputText -match 'reference') {
    $hint += "`n   -> Over ze project-ref odpovida instance v .env.local (DATABASE_URL)."
  }
  if ($OutputText -match 'ENOIDENTIFIER' -or $OutputText -match 'tenant identifier' -or $OutputText -match 'sni_hostname') {
    $hint += "`n   -> DUVOD: AWS regionálni pooler vyzaduje uzivatel jmeno ve formatu 'postgres.<project-ref>', ne holy 'postgres'. Skript uz si to automaticky vyzkousel."
  }
  return $hint
}

function Mask-StringTail {
  param(
    [Parameter(Mandatory)] [string] $Value,
    [int] $KeepLast = 3,
    [string] $Mask = '*'
  )
  if (-not $Value) { return '' }
  $maskStr = [string]$Mask
  if ($Value.Length -le $KeepLast) {
    $result = ''
    for ($i = 0; $i -lt $Value.Length; $i++) { $result += $maskStr }
    return $result
  }
  $maskCount = $Value.Length - $KeepLast
  $result = ''
  for ($i = 0; $i -lt $maskCount; $i++) { $result += $maskStr }
  return $result + $Value.Substring($maskCount)
}

function Mask-DatabaseUrl {
  param([Parameter(Mandatory)] [string] $Url)
  return [regex]::Replace($Url, '(postgresql://[^:]+:)[^@]+(@)', '${1}***${2}')
}

function Normalize-DatabaseUrlSsl {
  param([Parameter(Mandatory)] [string] $Url)
  if ($Url -notmatch '\?') { return "$Url`?sslmode=require" }
  if ($Url -notmatch 'sslmode=') { return "$Url`&sslmode=require" }
  return $Url
}

function Extract-ConnectionInfoFromLinkedDebug {
  param([Parameter(Mandatory)] [string] $DebugOutputText)
  $m = [regex]::Match($DebugOutputText, 'Using connection pooler:\s*(postgresql://[^\s]+)', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $m.Success) { return $null }
  $poolerUrl = $m.Groups[1].Value.Trim()
  $info = @{ PoolerUrl = $poolerUrl; PoolerUser = $null; PoolerHost = $null; PoolerPort = 5432; Region = $null }
  $mu = [regex]::Match($poolerUrl, '^postgresql://([^:]+)(:[^@]*)?@([^:]+):(\d+)/', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if ($mu.Success) {
    $info.PoolerUser = $mu.Groups[1].Value
    $info.PoolerHost = $mu.Groups[3].Value
    $info.PoolerPort = [int]$mu.Groups[4].Value
    $mr = [regex]::Match($info.PoolerHost, '^([a-z]{2,3}-\d+-[a-z0-9-]+)\.pooler\.supabase\.(?:co|com)$', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($mr.Success) {
      $info.Region = $mr.Groups[1].Value
    }
  }
  return $info
}

function Build-ConnectionUrl {
  param(
    [Parameter(Mandatory)] [string] $User,
    [Parameter(Mandatory)] [string] $Password,
    [Parameter(Mandatory)] [string] $DbHost,
    [int] $Port = 5432,
    [string] $Database = 'postgres'
  )
  $u = [Uri]::EscapeDataString($User)
  $p = [Uri]::EscapeDataString($Password)
  return "postgresql://$u`:$p@$DbHost`:$Port/$Database`?sslmode=require"
}

function New-DatabaseUrlCandidates {
  param(
    [Parameter(Mandatory)] [string] $ProjectRef,
    [Parameter(Mandatory)] [string] $DbPassword,
    [string] $DatabaseUrlFromEnv,
    $InfraInfo
  )
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($DatabaseUrlFromEnv) {
    $candidates.Add((Normalize-DatabaseUrlSsl -Url $DatabaseUrlFromEnv))
  }

  if ($InfraInfo -and $InfraInfo.PoolerHost -and $InfraInfo.PoolerUser) {
    $poolerUser = [string]$InfraInfo.PoolerUser
    $poolerHost = [string]$InfraInfo.PoolerHost
    $poolerPort = [int]$InfraInfo.PoolerPort

    $candidates.Add((Build-ConnectionUrl -User $poolerUser -Password $DbPassword -DbHost $poolerHost -Port $poolerPort))

    if ($InfraInfo.Region) {
      $region = [string]$InfraInfo.Region
      $directDbHost = "$region.db.supabase.com"
      $candidates.Add((Build-ConnectionUrl -User $poolerUser -Password $DbPassword -DbHost $directDbHost -Port 5432))
    }

    if ($poolerUser -ne 'postgres') {
      $candidates.Add((Build-ConnectionUrl -User 'postgres' -Password $DbPassword -DbHost $poolerHost -Port $poolerPort))
    }
  }

  $standardHost = "db.$ProjectRef.supabase.co"
  $candidates.Add((Build-ConnectionUrl -User 'postgres' -Password $DbPassword -DbHost $standardHost -Port 5432))
  $candidates.Add((Build-ConnectionUrl -User "postgres.$ProjectRef" -Password $DbPassword -DbHost $standardHost -Port 5432))

  $unique = New-Object System.Collections.Generic.List[string]
  foreach ($c in $candidates) {
    if (-not $unique.Contains($c)) { $unique.Add($c) }
  }
  return $unique.ToArray()
}

function Find-WorkingDatabaseUrl {
  param(
    [Parameter(Mandatory)] [string] $Workdir,
    [Parameter(Mandatory)] [string[]] $CandidateUrls,
    [int] $MaxToTry = 6
  )
  $tried = New-Object System.Collections.Generic.List[string]
  $count = 0
  foreach ($url in $CandidateUrls) {
    if ($count -ge $MaxToTry) { break }
    $count++
    $tried.Add($url)
    $masked = Mask-DatabaseUrl -Url $url
    Write-Host ''
    Write-Host "Probe [$count/$($CandidateUrls.Count)]: $masked"
    $probe = Invoke-Supabase -Workdir $Workdir -Args @('db', 'query', '--db-url', $url, '--log-level', 'error', 'select 1 as ok;')
    if ($probe.ExitCode -eq 0) {
      Write-Host ' -> OK'
      return @{ Url = $url; Tried = $tried.ToArray() }
    }
    $line = ($probe.Output -split "`r?`n" | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
    $short = if ($line) { $line.Trim() } else { 'pripojeni selhalo' }
    if ($short.Length -gt 120) { $short = $short.Substring(0, 117) + '...' }
    Write-Host " -> SELHALO: $short"
  }
  return @{ Url = $null; Tried = $tried.ToArray() }
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

$transcriptStarted = $false
try {
  Start-Transcript -Path $logFile -Force | Out-Null
  $transcriptStarted = $true
  Write-Host "Log: $logFile"

  Ensure-NodeInPath
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    throw 'npx nebylo nalezeno. Nainstaluj Node.js (obsahuje npm/npx) nebo pridej do PATH.'
  }

  $repoRootStr = [string]$repoRoot
  Write-Host "Repo: $repoRoot"
  Write-Host "Supabase dir: $supabaseDir"
  Write-Host "Nacitam konfiguraci z .env + .env.local (+ produkcni/staging varianty)..."
  Load-DotEnvIntoProcess -RepoRoot $repoRootStr

  $projectRef = $env:SUPABASE_PROJECT_REF
  if (-not $projectRef) {
    $projectRef = Get-ProjectRefFromDotEnv -RepoRoot $repoRootStr
  }
  if (-not $projectRef) {
    $projectRef = Get-ProjectRefFromUrl -Url (Get-DefaultSupabaseProjectUrl)
  }
  if (-not $projectRef) {
    $projectRef = Read-Host 'Zadej Supabase project ref (napr. aakbezmiacnwxzdutxjw)'
  }
  if (-not $projectRef) {
    throw 'Chybi Supabase project ref.'
  }
  Write-Host "Project ref: $projectRef"

  $dbPassword = Get-DbPassword
  if (-not $dbPassword) {
    throw 'Chybi DB heslo.'
  }
  Write-Host "DB heslo: delka=$($dbPassword.Length), posledni 3 znaky=$(Mask-StringTail -Value $dbPassword -KeepLast 3)"
  $env:SUPABASE_DB_PASSWORD = $dbPassword

  $databaseUrlFromEnv = $env:DATABASE_URL
  if ($databaseUrlFromEnv) {
    $databaseUrlFromEnv = Normalize-DatabaseUrlSsl -Url $databaseUrlFromEnv
    $envRef = Get-ProjectRefFromDbUrl -DbUrl $databaseUrlFromEnv
    if ($envRef -and $envRef -ne $projectRef) {
      Write-Host "VAROVANI: DATABASE_URL z .env(.local) ukazuje na projekt $envRef, project-ref je $projectRef."
    }
    Write-Host "DATABASE_URL (z env): $(Mask-DatabaseUrl -Url $databaseUrlFromEnv)"
  } else {
    Write-Host 'DATABASE_URL v env neni definovana.'
  }

  Write-Host ''
  Write-Host "Linkuji projekt: $projectRef"
  $link = Invoke-Supabase -Workdir $repoRoot -Args @('link', '--project-ref', $projectRef, '--yes')
  if ($link.ExitCode -ne 0) {
    throw "Supabase link selhal.`n$($link.Output)"
  }

  Write-Host ''
  Write-Host 'Detekuji databazovou infrastrukturu z --linked debug vystupu...'
  $probeLinked = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'query', '--linked', '--debug', '--log-level', 'debug', 'select 1 as ok;')
  $infraInfo = Extract-ConnectionInfoFromLinkedDebug -DebugOutputText $probeLinked.Output
  if ($infraInfo) {
    Write-Host "Pooler URL: $(Mask-DatabaseUrl -Url $infraInfo.PoolerUrl)"
    Write-Host "Pooler uzivatel: $($infraInfo.PoolerUser)"
    Write-Host "Pooler hostitel: $($infraInfo.PoolerHost):$($infraInfo.PoolerPort)"
    if ($infraInfo.Region) { Write-Host "Region prefix: $($infraInfo.Region)" }
  } else {
    Write-Host 'Nepodarilo se extrahovat pooler URL z debug vystupu. Pokracuji s pevne danym seznamem kandidatu.'
  }

  Write-Host ''
  Write-Host 'Sestavuji kandidatni DB URL a testuji je (connection probe)...'
  $candidates = New-DatabaseUrlCandidates -ProjectRef $projectRef -DbPassword $dbPassword -DatabaseUrlFromEnv $databaseUrlFromEnv -InfraInfo $infraInfo
  Write-Host "Pocet kandidatu: $($candidates.Count)"

  $probeResult = Find-WorkingDatabaseUrl -Workdir $repoRoot -CandidateUrls $candidates -MaxToTry $candidates.Count
  $databaseUrl = $probeResult.Url

  if (-not $databaseUrl) {
    Write-Host ''
    Write-Host 'ZADNA z kandidatnich URL neprosla. Pokousim se --linked fallback (pooler pres SUPABASE_DB_PASSWORD env)...'
    $linkedTest = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'query', '--linked', '--log-level', 'error', 'select 1 as ok;')
    if ($linkedTest.ExitCode -eq 0) {
      Write-Host ' -> OK, --linked pooler cesta funguje. Budu pouzivat --linked pro db push a migration list.'
      $databaseUrl = $null
      $useLinkedForEverything = $true
    } else {
      $hint = Format-DbAuthHint -OutputText ($probeLinked.Output + "`n" + $linkedTest.Output) -UsingMode 'connection probe vsech variant + --linked fallback' -TriedUrls $probeResult.Tried -ProjectRef $projectRef
      throw "Nepodarilo se navazat zadne DB spojeni.`n$hint"
    }
  } else {
    $useLinkedForEverything = $false
    Write-Host ''
    Write-Host "Pouzivam DB URL: $(Mask-DatabaseUrl -Url $databaseUrl)"
  }

  if (-not $useLinkedForEverything) {
    Write-Host ''
    Write-Host 'Overuji pripojeni (db query pres vybrane --db-url)...'
    $ping = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'query', '--db-url', $databaseUrl, '--log-level', 'error', 'select 1 as ok;')
    if ($ping.ExitCode -ne 0) {
      $hint = Format-DbAuthHint -OutputText $ping.Output -UsingMode '--db-url finalni spojeni' -ProjectRef $projectRef
      throw "Overeni --db-url spojeni po probe selhalo.`n$($ping.Output)$hint"
    }

    Write-Host ''
    Write-Host 'Aplikuji migrace na remote DB (db push pres --db-url)...'
    $push = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'push', '--db-url', $databaseUrl, '--include-all', '--yes', '--log-level', 'info')
    $pushMode = '--db-url (kandidat probe uspel)'
    if ($push.ExitCode -ne 0) {
      Write-Host ''
      Write-Host 'VAROVANI: db push pres --db-url selhal. Pokousim se --linked fallback...'
      $push = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'push', '--linked', '--include-all', '--yes', '--log-level', 'info')
      $pushMode = '--linked fallback'
    }
    if ($push.ExitCode -ne 0) {
      $hint = Format-DbAuthHint -OutputText $push.Output -UsingMode $pushMode -ProjectRef $projectRef
      throw "db push selhal (ExitCode=$($push.ExitCode)). Pouzity rezim: $pushMode`n$($push.Output)$hint"
    }
  } else {
    Write-Host ''
    Write-Host 'Aplikuji migrace na remote DB (db push pres --linked)...'
    $push = Invoke-Supabase -Workdir $repoRoot -Args @('db', 'push', '--linked', '--include-all', '--yes', '--log-level', 'info')
    $pushMode = '--linked pooler'
    if ($push.ExitCode -ne 0) {
      $hint = Format-DbAuthHint -OutputText $push.Output -UsingMode $pushMode -ProjectRef $projectRef
      throw "db push selhal (ExitCode=$($push.ExitCode)). Pouzity rezim: $pushMode`n$($push.Output)$hint"
    }
  }

  Write-Host ''
  Write-Host 'Kontroluji stav migraci (migration list)...'
  $listTried = @()
  if (-not $useLinkedForEverything -and $databaseUrl) {
    $list = Invoke-Supabase -Workdir $repoRoot -Args @('migration', 'list', '--db-url', $databaseUrl, '--log-level', 'none')
    $listTried += '--db-url'
  } else {
    $list = $null
  }
  if (-not $list -or $list.ExitCode -ne 0) {
    $list = Invoke-Supabase -Workdir $repoRoot -Args @('migration', 'list', '--linked', '--log-level', 'none')
    $listTried += '--linked'
  }
  if ($list.ExitCode -ne 0) {
    $hint = Format-DbAuthHint -OutputText $list.Output -UsingMode ($listTried -join ' + ') -ProjectRef $projectRef
    throw "migration list selhal.`n$($list.Output)$hint"
  }

  $missing = Get-MissingRemoteMigrationsFromTable -Text $list.Output
  if ($missing.Count -gt 0) {
    Write-Host ''
    Write-Host 'Remote DB je stale pozadu. Chybi tyto migrace:'
    $missing | ForEach-Object { Write-Host " - $_" }
    Write-Host ''
    Write-Host 'Pokus o rucni synchronizaci pres Node.js migrace (npm run db:migrate) MIGRATE_INCLUDE_LEGACY=true...'
    $prevPwd = Get-Location
    try {
      Set-Location $repoRootStr
      $env:MIGRATE_INCLUDE_LEGACY = 'true'
      npm run db:migrate
      if ($LASTEXITCODE -ne 0) {
        throw 'Remote migration list ukazuje chybejici migrace po db push a npm run db:migrate take selhal.'
      }
    } finally {
      Set-Location $prevPwd
    }
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
  Cleanup-OldLogs -LogDir $logDir -KeepLast 3
}
