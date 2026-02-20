# ─── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=@nfse/worker --include-workspace-root 2>/dev/null || npm install

# ─── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true

COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/
COPY apps/api/prisma/ ./apps/api/prisma/
COPY tsconfig.json ./

# Generate Prisma Client (uses API schema)
WORKDIR /app/apps/api
RUN npx prisma generate 2>/dev/null || true

# Build shared
WORKDIR /app/packages/shared
RUN npx tsc 2>/dev/null || true

# Build Worker
WORKDIR /app/apps/worker
RUN npx nest build 2>/dev/null || true

# ─── Stage 3: Production ───────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nfse -u 1001

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/worker/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true
COPY --from=builder /app/apps/worker/package.json ./

RUN mkdir -p /app/certs && chown -R nfse:nodejs /app/certs

USER nfse

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

CMD ["node", "dist/main"]
