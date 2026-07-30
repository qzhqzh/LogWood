#!/bin/sh
set -eu

: "${POSTGRES_ADMIN_PASSWORD:?Set the new POSTGRES_ADMIN_PASSWORD first}"
: "${POSTGRES_APP_PASSWORD:?Set the new POSTGRES_APP_PASSWORD first}"

sh scripts/validate-db-secrets.sh

POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}"
POSTGRES_APP_USER="${POSTGRES_APP_USER:-logwood_app}"
POSTGRES_DB="${POSTGRES_DB:-logwood}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [ "$POSTGRES_APP_USER" = "$POSTGRES_ADMIN_USER" ]; then
  echo "[db-upgrade] Application user must differ from the database administrator" >&2
  exit 1
fi

echo "[db-upgrade] Updating credentials in the currently running PostgreSQL container..."
docker compose exec -T --user postgres \
  -e POSTGRES_ADMIN_USER="$POSTGRES_ADMIN_USER" \
  -e POSTGRES_ADMIN_PASSWORD="$POSTGRES_ADMIN_PASSWORD" \
  -e POSTGRES_APP_USER="$POSTGRES_APP_USER" \
  -e POSTGRES_APP_PASSWORD="$POSTGRES_APP_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -e POSTGRES_HOST=/var/run/postgresql \
  -e POSTGRES_PORT="$POSTGRES_PORT" \
  -e POSTGRES_ROTATE_ADMIN_PASSWORD=1 \
  postgres sh -s < scripts/bootstrap-db.sh

echo "[db-upgrade] Credentials updated. Start the new stack with docker compose up -d --build."
