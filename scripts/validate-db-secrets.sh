#!/bin/sh
set -eu

: "${POSTGRES_ADMIN_PASSWORD:?POSTGRES_ADMIN_PASSWORD is required}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD is required}"

validate_secret() {
  name="$1"
  value="$2"
  if [ "${#value}" -lt 32 ]; then
    echo "[db-secrets] $name must contain at least 32 characters" >&2
    exit 1
  fi
  case "$value" in
    *[!A-Za-z0-9]*)
      echo "[db-secrets] $name must contain only URL-safe alphanumeric characters" >&2
      exit 1
      ;;
  esac
}

if [ "${LOGWOOD_ALLOW_LEGACY_DB_ROLLBACK:-0}" = "1" ]; then
  echo "[db-secrets] Explicit legacy rollback mode enabled for the administrator password"
else
  validate_secret "POSTGRES_ADMIN_PASSWORD" "$POSTGRES_ADMIN_PASSWORD"
fi
validate_secret "POSTGRES_APP_PASSWORD" "$POSTGRES_APP_PASSWORD"

if [ "$POSTGRES_ADMIN_PASSWORD" = "$POSTGRES_APP_PASSWORD" ]; then
  echo "[db-secrets] Administrator and application passwords must differ" >&2
  exit 1
fi

echo "[db-secrets] Database credentials passed validation"
