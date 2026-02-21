# ─── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

# Copy root workspace files
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (monorepo flat install)
RUN npm install

# ─── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build shared
WORKDIR /app/packages/shared
RUN npx tsc || true

# Build API
WORKDIR /app/apps/api
RUN npx nest build && npx tsc prisma/seed.ts

# ─── Stage 3: Production ───────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl wget

WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nfse -u 1001

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./

# Create certs directory and ensure nfse user can write to prisma engines
RUN mkdir -p /app/certs && \
    chown -R nfse:nodejs /app/certs && \
    chown -R nfse:nodejs /app/node_modules/.prisma && \
    chown -R nfse:nodejs /app/node_modules/@prisma

USER nfse

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD wget --spider -q http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node dist/main"]
