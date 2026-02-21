# ─── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (monorepo flat install)
RUN npm install

# ─── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/
COPY apps/api/prisma/ ./apps/api/prisma/
COPY tsconfig.json ./

# Generate Prisma Client (uses API schema)
WORKDIR /app/apps/api
RUN npx prisma generate

# Build shared
WORKDIR /app/packages/shared
RUN npx tsc || true

# Build Worker
WORKDIR /app/apps/worker
RUN npx nest build

# ─── Stage 3: Production ───────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nfse -u 1001

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/package.json ./

RUN mkdir -p /app/certs && \
    chown -R nfse:nodejs /app/certs && \
    chown -R nfse:nodejs /app/node_modules/.prisma && \
    chown -R nfse:nodejs /app/node_modules/@prisma

USER nfse

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

CMD ["node", "dist/main"]
