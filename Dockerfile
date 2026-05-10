FROM oven/bun:1-slim

ARG DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
		PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}

WORKDIR /app

RUN set -eux; \
		if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
			sed -i "s|https\?://deb.debian.org/debian|${DEBIAN_MIRROR}/debian|g; s|https\?://security.debian.org/debian-security|${DEBIAN_MIRROR}/debian-security|g" /etc/apt/sources.list.d/debian.sources; \
		fi; \
		apt-get update -y; \
		apt-get install -y --no-install-recommends openssl; \
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

EXPOSE 3000
