# ─── Stage 1: Build TypeScript ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Production ───────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache wget

WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nfse -u 1001

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER nfse

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget --spider -q http://localhost:4000/health || exit 1

CMD ["node", "dist/app.js"]
