#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
output="$BACKUP_DIR/dvs_factory-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump "$DATABASE_URL" --format=custom --file="$output" --no-owner --no-privileges
find "$BACKUP_DIR" -type f -name '*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "Created $output"
