#!/bin/sh
set -e

MODE="${NODE_ENV:-production}"

echo "[entrypoint] Starting web container in ${MODE} mode..."

# Install dependencies
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[entrypoint] node_modules missing, running bun install..."
  bun install
else
  echo "[entrypoint] node_modules exists, skipping install"
fi

echo "[entrypoint] Generating Prisma client..."
bunx prisma generate

echo "[entrypoint] Syncing schema with database..."
bunx prisma db push

if [ "${FORCE_DB_SEED:-0}" = "1" ]; then
  echo "[entrypoint] FORCE_DB_SEED=1, running seed..."
  bun run db:seed
else
  echo "[entrypoint] Checking whether seed is needed..."
  SEED_NEEDED=$(bun <<'BUNSCRIPT'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const targetCount = await prisma.target.count()
  process.stdout.write(targetCount === 0 ? 'true' : 'false')
} catch {
  process.stdout.write('true')
} finally {
  await prisma.$disconnect()
}
BUNSCRIPT
)

  if [ "$SEED_NEEDED" = "true" ]; then
    echo "[entrypoint] Empty database detected, running seed..."
    bun run db:seed
  else
    echo "[entrypoint] Existing data detected, skip seed"
  fi
fi

if [ "$MODE" = "production" ]; then
  echo "[entrypoint] Building Next.js for production..."
  bun run build
  echo "[entrypoint] Starting Next.js production server..."
  exec bun run start
else
  echo "[entrypoint] Starting Next.js dev server..."
  exec bun run dev
fi
