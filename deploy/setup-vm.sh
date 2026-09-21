#!/usr/bin/env bash
# One-shot, unattended setup for the Attendance app on a fresh Ubuntu Server
# 22.04/24.04 VM (systemd service + nginx reverse proxy).
#
#   sudo mkdir -p /opt/attendance-check-point
#   sudo chown "$USER" /opt/attendance-check-point
#   # Get the code into /opt/attendance-check-point: `git clone` on your own
#   # dev/staging machine, or extract a `git archive` release zip on a
#   # client's machine -- see DEPLOY.md's "Getting the code onto a machine"
#   # section for why a client's box shouldn't be a clone of this private repo.
#   cd /opt/attendance-check-point
#   sudo bash deploy/setup-vm.sh
#
# Safe to re-run after pulling (or re-copying a newer release zip onto) the
# code: it rebuilds the frontend, re-runs migrations, and restarts the
# service. It will NOT overwrite an existing .env, recreate the
# database/role, or reset the admin password on a re-run unless you
# explicitly pass ADMIN_PASSWORD.
#
# Everything is generated automatically if not supplied via env vars:
#   DB_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD
# Generated secrets/passwords are printed once at the end -- save them then.

set -euo pipefail

APP_DIR="/opt/attendance-check-point"
APP_USER="attendance"
DB_NAME="${DB_NAME:-attendance_db}"
DB_USER="${DB_USER:-attendance_user}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@company.local}"

step() { echo -e "\n==> $*"; }
info() { echo "    $*"; }

if [ "$EUID" -ne 0 ]; then
  echo "Run this with sudo (it installs system packages and a systemd unit)." >&2
  exit 1
fi

if [ "$(pwd)" != "$APP_DIR" ]; then
  echo "This script expects the repo to be checked out at $APP_DIR (currently in $(pwd))." >&2
  exit 1
fi

random_secret() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || openssl rand -hex 48; }
random_password() { node -e "console.log(require('crypto').randomBytes(15).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,20))" 2>/dev/null || tr -dc 'A-Za-z0-9' </dev/urandom | head -c20; }

step "Installing Node.js LTS, PostgreSQL, nginx"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y postgresql postgresql-contrib nginx openssl ufw

step "Ensuring dedicated app user exists"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

step "Preparing .env"
FIRST_RUN=0
if [ ! -f "$APP_DIR/.env" ]; then
  FIRST_RUN=1
  DB_PASSWORD="${DB_PASSWORD:-$(random_password)}"
  JWT_SECRET="$(random_secret)"
  JWT_REFRESH_SECRET="$(random_secret)"

  info "No .env found -- generating one from .env.example with fresh secrets."
  cp .env.example .env
  sed -i "s/^NODE_ENV=.*/NODE_ENV=production/" .env
  sed -i "s/^DB_NAME=.*/DB_NAME=$DB_NAME/" .env
  sed -i "s/^DB_USER=.*/DB_USER=$DB_USER/" .env
  sed -i "s#^DB_PASSWORD=.*#DB_PASSWORD=$DB_PASSWORD#" .env
  sed -i "s#^JWT_SECRET=.*#JWT_SECRET=$JWT_SECRET#" .env
  sed -i "s#^JWT_REFRESH_SECRET=.*#JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET#" .env
else
  info ".env already exists -- leaving it untouched."
  # Pull DB_* back out of the existing .env so the CREATE ROLE/DATABASE step
  # below stays in sync with whatever is actually configured.
  DB_NAME="$(grep -m1 '^DB_NAME=' .env | cut -d= -f2-)"
  DB_USER="$(grep -m1 '^DB_USER=' .env | cut -d= -f2-)"
  DB_PASSWORD="$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2-)"
fi

step "Creating database and role (if not already present)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

step "Installing dependencies and building frontend"
npm ci
(cd frontend && npm ci && npm run build)

step "Checking for known-vulnerable dependencies (informational, non-blocking)"
npm audit --omit=dev || true

step "Running database migrations"
npm run db:migrate

step "Creating the first admin account (safe to re-run -- updates the password if ADMIN_PASSWORD is set)"
if [ "$FIRST_RUN" = "1" ] || [ -n "${ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(random_password)}"
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" npm run db:create-admin
else
  info "Admin account already provisioned from a previous run -- pass ADMIN_PASSWORD=... to reset it."
fi

step "Installing systemd service"
cp deploy/attendance-backend.service /etc/systemd/system/attendance-backend.service
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
systemctl daemon-reload
systemctl enable attendance-backend
systemctl restart attendance-backend

step "Installing nginx site"
cp deploy/nginx.conf /etc/nginx/sites-available/attendance
ln -sf /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/attendance
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

step "Opening LAN access (ufw, if active)"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  info "Allowed port 80/tcp through ufw."
else
  info "ufw is not active -- skipping (no firewall blocking port 80 by default on this VM)."
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo ""
echo "================================================================"
echo " Attendance app is running (systemd: attendance-backend, nginx)."
echo "================================================================"
[ -n "$LAN_IP" ] && echo " URL: http://$LAN_IP/"
echo ""
echo " Admin login:"
echo "   Email:    $ADMIN_EMAIL"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo "   Password: $ADMIN_PASSWORD"
else
  echo "   Password: (unchanged from a previous run)"
fi
if [ "$FIRST_RUN" = "1" ]; then
  echo ""
  echo " Database password (save this, it's only shown once):"
  echo "   $DB_PASSWORD"
fi
echo ""
echo " This installation is not licensed yet. Send this machine ID to"
echo " activate it, then paste the license you get back into the app's"
echo " Activate License screen (log in as admin first):"
echo "   $(node -e "console.log(require('./backend/src/utils/machineId').getMachineId())")"
echo ""
echo " Day to day:"
echo "   systemctl status attendance-backend nginx"
echo "   journalctl -u attendance-backend -f"
echo " After a code update (git pull, or a new release zip extracted over this folder):"
echo "   sudo bash deploy/setup-vm.sh"
echo "================================================================"
