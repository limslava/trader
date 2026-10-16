#!/usr/bin/env bash
# Deploys the current working tree to Legion and rebuilds the stack.
#   scripts/deploy-legion.sh            # sync + build + restart
# Secrets live only in ~/trader/.env on the server (see docs/LEGION.md).
set -euo pipefail
HOST=${LEGION_HOST:-vladislav@legion.local}
cd "$(dirname "$0")/.."
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .env --exclude backups \
  --exclude .git --exclude .claude --exclude '*.log' \
  ./ "$HOST:trader/"
ssh "$HOST" 'cd ~/trader && docker compose -f docker-compose.legion.yml up -d --build --remove-orphans && docker compose -f docker-compose.legion.yml ps'
