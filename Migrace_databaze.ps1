$ErrorActionPreference = 'Stop'

$defaultProjectRef = ''

function Ensure-NodeInPath {
  if (Get-Command node -ErrorAction SilentlyContinue) { return }
  $nodeDir = 'C:\Program Files\nodejs'
  if (Test-Path $nodeDir) {
    $env:Path = "$nodeDir;$env:Path"
  }
}

function Get-ProjectRefFromDotEnv {
  $envPath = Join-Path $PSScriptRoot '.env'
  if (-not (Test-Path $envPath)) { return $null }
  $line = Get-Content $envPath -ErrorAction SilentlyContinue | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1
  if (-not $line) { return $null }
  $url = ($line -split '=', 2)[1].Trim()
  if (-not $url) { return $null }
  try {
    $u = [Uri]$url
    $host = $u.Host
  } catch {
    return $null
  }
  if (-not $host) { return $null }
  $first = ($host -split '\.')[0]
  if (-not $first) { return $null }
  return $first
}

Ensure-NodeInPath

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw 'npx nebylo nalezeno. Nainstaluj Node.js (obsahuje npm/npx) nebo přidej do PATH.'
}

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { $defaultProjectRef }
if (-not $projectRef) {
  $projectRef = Get-ProjectRefFromDotEnv
}
if (-not $projectRef) {
  $projectRef = Read-Host ojnpqxfaiuyfpsogthhx
}
if (-not $projectRef) {
  throw 'Chybí Supabase project ref.'
}

$dbPassword = $env:SUPABASE_DB_PASSWORD
if (-not $dbPassword) {
  $secure = Read-Host Luky7757221021* -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

if (-not $dbPassword) {
  throw 'Chybí DB heslo.'
}

Write-Host "Linkuji projekt: $projectRef"
& npx supabase link --project-ref $projectRef --yes

Write-Host 'Aplikuji migrace na remote DB (db push)...'
& npx supabase db push --linked --include-all --password $dbPassword --yes

Write-Host 'Hotovo.'
