#!/usr/bin/env bash
# Nightly PostgreSQL backup for the docker-compose.prod.yml stack.
#
#   ./scripts/backup-db.sh                 # writes backups/artisan_saas-YYYYmmdd-HHMMSS.dump.gz
#   BACKUP_DIR=/mnt/backups RETENTION_DAYS=14 ./scripts/backup-db.sh
#   S3_BUCKET=s3://my-bucket/artisan ./scripts/backup-db.sh   # also uploads (needs aws cli)
#
# Cron example (02:30 daily):
#   30 2 * * * cd /opt/artisan-saas && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Restore:
#   gunzip -c backups/<file>.dump.gz | docker compose -f docker-compose.prod.yml --env-file .env.production \
#     exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${POSTGRES_USER:=artisan}"
: "${POSTGRES_DB:=artisan_saas}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%d-%H%M%S)"
file="$BACKUP_DIR/${POSTGRES_DB}-${stamp}.dump.gz"

echo "[$(date -u +%FT%TZ)] dumping $POSTGRES_DB -> $file"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner \
  | gzip -9 > "$file"

size="$(du -h "$file" | cut -f1)"
echo "[$(date -u +%FT%TZ)] done ($size)"

if [[ -n "${S3_BUCKET:-}" ]]; then
  aws s3 cp "$file" "$S3_BUCKET/$(basename "$file")" --only-show-errors
  echo "[$(date -u +%FT%TZ)] uploaded to $S3_BUCKET"
fi

find "$BACKUP_DIR" -name "${POSTGRES_DB}-*.dump.gz" -type f -mtime "+$RETENTION_DAYS" -print -delete \
  | sed 's/^/pruned: /'
