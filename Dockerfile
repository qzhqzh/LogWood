FROM oven/bun:1-slim

ARG DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
		PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR} \
		# Default to production. docker-compose can override this back to
		# development for local hot-reload via `NODE_ENV=development`.
		NODE_ENV=production

WORKDIR /app

# `openssl` is required by Prisma engines; `wget` is used by the HEALTHCHECK
# below to probe the in-process /api/health endpoint without pulling curl.
RUN set -eux; \
		if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
			sed -i "s|https\?://deb.debian.org/debian|${DEBIAN_MIRROR}/debian|g; s|https\?://security.debian.org/debian-security|${DEBIAN_MIRROR}/debian-security|g" /etc/apt/sources.list.d/debian.sources; \
		fi; \
		apt-get update -y; \
		apt-get install -y --no-install-recommends openssl wget; \
		rm -rf /var/lib/apt/lists/*

# Install dependencies first to maximize layer cache reuse.
COPY package*.json ./
COPY .npmrc ./.npmrc
RUN bun install

# Copy source code (needed for production builds).
# In dev mode, bind mount overrides this COPY.
COPY . .

# Prisma client generation requires schema files in the image.
COPY prisma ./prisma
RUN bunx prisma generate

# `oven/bun:1-slim` ships with a non-root `bun` user (UID/GID 1000). We chown
# the workdir so it can read/write its own files when running as that user.
# Note: when `docker-compose.yml` bind-mounts the host workspace at /app, the
# host filesystem permissions take precedence; on Linux, the host UID
# typically matches 1000 so this is fine. If you run with a different host UID
# in development, override `user:` in docker-compose to match.
RUN chown -R bun:bun /app

USER bun

EXPOSE 3000

# Liveness probe. `bun run start` listens on $PORT (default 3000); the
# /api/health endpoint never touches the DB so it is safe to poll
# aggressively. Build/dev modes still respond to /api/health, so this works
# uniformly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
		CMD wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/health || exit 1
