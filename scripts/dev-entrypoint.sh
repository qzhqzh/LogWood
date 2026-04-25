#!/bin/sh
set -e

echo "[dev-entrypoint] Starting web container..."

LOCKFILE_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
LOCKFILE_HASH_FILE="node_modules/.package-lock.hash"

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[dev-entrypoint] node_modules missing, running npm ci..."
  npm ci
  mkdir -p node_modules
  printf '%s\n' "$LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
elif [ ! -f "$LOCKFILE_HASH_FILE" ] || [ "$(cat "$LOCKFILE_HASH_FILE" 2>/dev/null)" != "$LOCKFILE_HASH" ]; then
  echo "[dev-entrypoint] package-lock changed, running npm ci..."
  npm ci
  printf '%s\n' "$LOCKFILE_HASH" > "$LOCKFILE_HASH_FILE"
else
  echo "[dev-entrypoint] node_modules is up to date, skip npm ci"
fi

echo "[dev-entrypoint] Generating Prisma client..."
npx prisma generate

echo "[dev-entrypoint] Syncing schema with database..."
npx prisma db push

if [ "${FORCE_DB_SEED:-0}" = "1" ]; then
  echo "[dev-entrypoint] FORCE_DB_SEED=1, running seed..."
  npm run db:seed
else
  echo "[dev-entrypoint] Checking whether seed is needed..."
  SEED_NEEDED=$(node <<'EOF'
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const targetCount = await prisma.target.count()
  process.stdout.write(targetCount === 0 ? 'true' : 'false')
}

main()
  .catch(() => {
    process.stdout.write('true')
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
EOF
)

  if [ "$SEED_NEEDED" = "true" ]; then
    echo "[dev-entrypoint] Empty database detected, running seed..."
    npm run db:seed
  else
    echo "[dev-entrypoint] Existing data detected, skip seed"
  fi
fi

echo "[dev-entrypoint] Starting Next.js dev server..."
exec npm run dev
