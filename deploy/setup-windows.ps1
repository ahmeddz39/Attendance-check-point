<#
.SYNOPSIS
  One-shot, unattended setup for the Attendance app on a Windows PC, running
  under PM2 (survives crashes, resurrects on user login).

.DESCRIPTION
  Run this from an elevated ("Run as Administrator") PowerShell 7+ prompt,
  from the repo root, right after getting the code onto this machine --
  either `git clone` (your own dev/staging machine) or extracting a
  `git archive` release zip (a client's machine -- see DEPLOY.md's
  "Getting the code onto a machine" section for why a client's box
  shouldn't be a clone of this private repo):

    cd C:\Apps\Attendance-check-point
    .\deploy\setup-windows.ps1

  Every step is idempotent -- safe to re-run after pulling (or re-copying
  a newer release zip onto) the code to pick up changes (it will rebuild
  the frontend, re-run migrations, and restart the PM2 process; it will
  NOT overwrite an existing .env or recreate the database/admin account).

  All parameters are optional. Anything not supplied is auto-generated
  (DB password, JWT secrets, admin password) so this can run fully
  unattended -- generated values are printed at the end, not silently lost.

.PARAMETER Port
  TCP port the app listens on (also opened in Windows Firewall for the
  Private network profile). Default 4000.

.PARAMETER DbName / DbUser / DbPassword
  Postgres database/role to create. DbPassword is auto-generated if omitted.

.PARAMETER AdminEmail / AdminPassword
  First login account. AdminPassword is auto-generated if omitted.
  If both the account and .env already exist from a previous run, this
  step is skipped (re-run is a no-op for identity, not a reset).

.EXAMPLE
  .\deploy\setup-windows.ps1
  .\deploy\setup-windows.ps1 -AdminEmail admin@mycompany.com -Port 4000
#>

[CmdletBinding()]
param(
  [int]$Port = 4000,
  [string]$DbName = 'attendance_db',
  [string]$DbUser = 'attendance_user',
  [string]$DbPassword,
  [string]$AdminEmail = 'admin@company.local',
  [string]$AdminPassword,
  # Only needed if your PostgreSQL install requires a password for the
  # 'postgres' superuser to create the app's role/database (a freshly
  # winget-installed PostgreSQL usually does -- check its installer output).
  [string]$PgSuperUser = 'postgres',
  [string]$PgSuperPassword
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

function New-RandomSecret([int]$bytes = 32) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  -join ($buf | ForEach-Object { $_.ToString('x2') })
}

function New-RandomPassword {
  # Alphanumeric only -- avoids quoting headaches in .env / psql / URLs.
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  -join (1..20 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

# ── 0. Preconditions ─────────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "This script needs an elevated (Administrator) PowerShell prompt -- it registers a firewall rule and a startup task." -ForegroundColor Red
  Write-Host "Right-click PowerShell -> Run as Administrator, then re-run this script." -ForegroundColor Red
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
if (-not (Test-Path (Join-Path $repoRoot 'package.json'))) {
  Write-Host "Run this from the repo root (expected package.json at $repoRoot)." -ForegroundColor Red
  exit 1
}

# ── 1. Node.js ───────────────────────────────────────────────────────────────
Write-Step "Checking Node.js"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Info "Node.js not found -- installing LTS via winget..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "winget is not available and Node.js is missing. Install Node.js 18+ manually from https://nodejs.org, then re-run this script." -ForegroundColor Red
    exit 1
  }
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
  Write-Warn2 "Node.js was just installed -- close this window and re-run the script from a NEW PowerShell prompt so PATH picks it up."
  exit 0
}
Write-Ok "Node.js $(node --version) found."

# ── 2. PostgreSQL ────────────────────────────────────────────────────────────
Write-Step "Checking PostgreSQL"
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  Write-Info "psql not found on PATH -- installing PostgreSQL via winget..."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "winget is not available and PostgreSQL is missing. Install PostgreSQL 14+ manually from https://www.postgresql.org/download/windows/, then re-run this script." -ForegroundColor Red
    exit 1
  }
  winget install --id PostgreSQL.PostgreSQL -e --silent --accept-package-agreements --accept-source-agreements
  Write-Warn2 "PostgreSQL was just installed -- close this window and re-run the script from a NEW PowerShell prompt so PATH picks up psql.exe."
  exit 0
}
Write-Ok "psql found: $($psql.Source)"

$pgService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService -and $pgService.Status -ne 'Running') {
  Write-Info "Starting PostgreSQL service ($($pgService.Name))..."
  Start-Service $pgService.Name
}

# ── 3. .env (write once; never overwritten on re-run) ────────────────────────
Write-Step "Preparing .env"
$envPath = Join-Path $repoRoot '.env'
$firstRun = -not (Test-Path $envPath)

if ($firstRun) {
  if (-not $DbPassword) { $DbPassword = New-RandomPassword }
  $jwtSecret = New-RandomSecret 48
  $jwtRefreshSecret = New-RandomSecret 48

  Write-Info "No .env found -- generating one from .env.example with fresh secrets."
  $content = Get-Content (Join-Path $repoRoot '.env.example') -Raw
  $content = $content -replace '(?m)^NODE_ENV=.*',        'NODE_ENV=production'
  $content = $content -replace '(?m)^PORT=.*',             "PORT=$Port"
  $content = $content -replace '(?m)^DB_NAME=.*',          "DB_NAME=$DbName"
  $content = $content -replace '(?m)^DB_USER=.*',          "DB_USER=$DbUser"
  $content = $content -replace '(?m)^DB_PASSWORD=.*',      "DB_PASSWORD=$DbPassword"
  $content = $content -replace '(?m)^JWT_SECRET=.*',       "JWT_SECRET=$jwtSecret"
  $content = $content -replace '(?m)^JWT_REFRESH_SECRET=.*', "JWT_REFRESH_SECRET=$jwtRefreshSecret"
  $content = $content -replace '(?m)^CLIENT_URL=.*',       "CLIENT_URL=http://localhost:$Port"
  Set-Content -Path $envPath -Value $content -NoNewline
  Write-Ok ".env written with a generated DB password and JWT secrets."
} else {
  Write-Info ".env already exists -- leaving it untouched. Delete it first if you want fresh generated secrets."
  # Pull DB_* back out of the existing .env so the CREATE ROLE/DATABASE step
  # below stays in sync with whatever is actually configured.
  $existing = Get-Content $envPath | Where-Object { $_ -match '^\s*(DB_NAME|DB_USER|DB_PASSWORD)\s*=' }
  foreach ($line in $existing) {
    $k, $v = $line -split '=', 2
    switch ($k.Trim()) {
      'DB_NAME'     { $DbName = $v.Trim() }
      'DB_USER'     { $DbUser = $v.Trim() }
      'DB_PASSWORD' { $DbPassword = $v.Trim() }
    }
  }
}

# ── 4. Database + role ───────────────────────────────────────────────────────
Write-Step "Creating database and role (if not already present)"
if ($PgSuperPassword) { $env:PGPASSWORD = $PgSuperPassword }
try {
  $roleExists = (& psql -U $PgSuperUser -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DbUser'" 2>$null)
} catch {
  Write-Host "Could not connect to PostgreSQL as '$PgSuperUser'. If this PostgreSQL install has a superuser password, re-run with -PgSuperPassword '<it>'." -ForegroundColor Red
  exit 1
}
if ($roleExists -ne '1') {
  & psql -U $PgSuperUser -c "CREATE ROLE $DbUser LOGIN PASSWORD '$DbPassword';" | Out-Null
  Write-Ok "Role '$DbUser' created."
} else {
  Write-Info "Role '$DbUser' already exists."
}
$dbExists = (& psql -U $PgSuperUser -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName'" 2>$null)
if ($dbExists -ne '1') {
  & psql -U $PgSuperUser -c "CREATE DATABASE $DbName OWNER $DbUser;" | Out-Null
  Write-Ok "Database '$DbName' created."
} else {
  Write-Info "Database '$DbName' already exists."
}
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# ── 5. Install dependencies + build frontend ─────────────────────────────────
Write-Step "Installing dependencies (this can take a few minutes on first run)"
npm ci
Push-Location frontend
npm ci
Write-Step "Building frontend"
npm run build
Pop-Location

Write-Step "Checking for known-vulnerable dependencies (informational, non-blocking)"
try { npm audit --omit=dev } catch {}

# ── 6. Migrations ─────────────────────────────────────────────────────────────
Write-Step "Running database migrations"
npm run db:migrate

# ── 7. PM2 ────────────────────────────────────────────────────────────────────
Write-Step "Setting up PM2"
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
  Write-Info "Installing pm2 + pm2-windows-startup globally..."
  npm install -g pm2 pm2-windows-startup
}
pm2 start ecosystem.config.js --update-env
pm2 save
try {
  pm2-startup install
  Write-Ok "PM2 will resurrect the app when this Windows user logs back in."
} catch {
  Write-Warn2 "pm2-startup install failed (non-fatal) -- run it manually later: pm2-startup install"
}

# ── 8. Firewall ───────────────────────────────────────────────────────────────
Write-Step "Opening LAN access on port $Port (Private network profile)"
$ruleName = "Attendance App LAN ($Port)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private | Out-Null
  Write-Ok "Firewall rule '$ruleName' created."
} else {
  Write-Info "Firewall rule '$ruleName' already exists."
}

# ── 9. First admin account ────────────────────────────────────────────────────
Write-Step "Creating the first admin account (safe to re-run -- updates the password if the account already exists)"
if (-not $AdminPassword) { $AdminPassword = New-RandomPassword }
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword
npm run db:create-admin
Remove-Item Env:\ADMIN_EMAIL, Env:\ADMIN_PASSWORD -ErrorAction SilentlyContinue

# ── Done ──────────────────────────────────────────────────────────────────────
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '169.254.*' -and
    $_.IPAddress -ne '127.0.0.1' -and
    ($_.PrefixOrigin -eq 'Manual' -or $_.PrefixOrigin -eq 'Dhcp')
  } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host " Attendance app is running under PM2." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host " Local:  http://localhost:$Port"
if ($lanIp) { Write-Host " LAN:    http://${lanIp}:$Port" }
Write-Host ""
Write-Host " Admin login:"
Write-Host "   Email:    $AdminEmail"
Write-Host "   Password: $AdminPassword"
Write-Host ""
if ($firstRun) {
  Write-Host " Database password (save this, it's only shown once):"
  Write-Host "   $DbPassword"
  Write-Host ""
}
$machineId = node -e "console.log(require('./backend/src/utils/machineId').getMachineId())"
Write-Host " This installation is not licensed yet. Send this machine ID to"
Write-Host " activate it, then paste the license you get back into the app's"
Write-Host " Activate License screen (log in as admin first):"
Write-Host "   $machineId"
Write-Host ""
Write-Host " Day to day:"
Write-Host "   pm2 status / pm2 logs attendance-app / pm2 restart attendance-app"
Write-Host " After a code update (git pull, or a new release zip extracted over this folder):"
Write-Host "   .\deploy\setup-windows.ps1"
Write-Host "================================================================`n" -ForegroundColor Green
