# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json ./
# Copy workspace packages package.json
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend SPA
WORKDIR /app/apps/frontend
RUN npm run build

# ─── Stage 2: Production Nginx ─────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Expose standard port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
