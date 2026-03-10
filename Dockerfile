FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies first to maximize layer cache reuse.
COPY package*.json ./
RUN npm ci

# Prisma client generation requires schema files in the image.
COPY prisma ./prisma
RUN npx prisma generate

# Source is bind-mounted in docker-compose for local development.
EXPOSE 3000
