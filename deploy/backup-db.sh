#!/usr/bin/env bash
# Nightly Postgres backup for the Attendance app.
# Install with a cron entry (as root), e.g.:
#   0 2 * * * /opt/attendance-check-point/deploy/backup-db.sh
#
# Reads DB name/user from the app's .env so it stays in sync automatically.

set -euo pipefail

APP_DIR="/opt/attendance-check-point"
BACKUP_DIR="/opt/attendance-backups"
RETENTION_DAYS=14

set -a
source "$APP_DIR/.env"
set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

PGPASSWORD="$DB_PASSWORD" pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup written to $FILE"
