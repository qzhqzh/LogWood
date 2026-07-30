#!/bin/sh
set -eu

: "${POSTGRES_ADMIN_USER:?POSTGRES_ADMIN_USER is required}"
: "${POSTGRES_ADMIN_PASSWORD:?POSTGRES_ADMIN_PASSWORD is required}"
: "${POSTGRES_APP_USER:?POSTGRES_APP_USER is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

if [ "$POSTGRES_APP_USER" = "$POSTGRES_ADMIN_USER" ]; then
  echo "[db-bootstrap] Application user must differ from the database administrator" >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_ADMIN_PASSWORD"

psql \
  --host postgres \
  --username "$POSTGRES_ADMIN_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set admin_user="$POSTGRES_ADMIN_USER" \
  --set app_user="$POSTGRES_APP_USER" \
  --set app_password="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'app_user')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)
\gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'app_user',
  :'app_password'
)
\gexec

SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'app_user'
)
\gexec

SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_user')
\gexec

SELECT format(
  'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I',
  :'app_user'
)
\gexec

SELECT format(
  'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I',
  :'app_user'
)
\gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I',
  :'admin_user',
  :'app_user'
)
\gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I',
  :'admin_user',
  :'app_user'
)
\gexec
SQL

echo "[db-bootstrap] Application database role is ready"
