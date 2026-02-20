# ─── Stage 1: Install dependencies ─────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy root workspace files
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN npm install --workspace=@nfse/api --include-workspace-root 2>/dev/null || npm install

# ─── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate 2>/dev/null || true

# Build shared
WORKDIR /app/packages/shared
RUN npx tsc 2>/dev/null || true

# Build API
WORKDIR /app/apps/api
RUN npx nest build 2>/dev/null || true

# ─── Stage 3: Production ───────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nfse -u 1001

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true
COPY --from=builder /app/apps/api/package.json ./

# Create certs directory
RUN mkdir -p /app/certs && chown -R nfse:nodejs /app/certs

USER nfse

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD wget --spider -q http://localhost:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
