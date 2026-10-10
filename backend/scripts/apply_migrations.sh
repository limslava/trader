#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-russian-trader-postgres}"
DB_NAME="${DB_NAME:-russian-trader}"
DB_USER="${DB_USER:-trader}"

echo "Applying SQL patches to ${DB_NAME} in container ${DB_CONTAINER}..."

if [[ -f "$ROOT_DIR/../postgres-init.sql" ]]; then
  echo "-> postgres-init.sql"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$ROOT_DIR/../postgres-init.sql"
fi

for file in "$ROOT_DIR"/sql/patch_v2_*.sql; do
  if [[ -f "$file" ]]; then
    echo "-> $(basename "$file")"
    docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$file"
  fi
done

echo "Done."
