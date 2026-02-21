FROM node:20-alpine AS base

# Dev stage for Hot Reloading execution
FROM base AS dev
WORKDIR /usr/src/app
# We don't copy package.json here because the docker-compose maps volumes. 
# We just need the command to run 'npm run dev' inside the monorepo map.
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage for CI/CD or Prod
FROM base AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/
RUN npm install
COPY . .
# We build shared + frontend
RUN cd packages/shared && npm run build
RUN cd apps/frontend && npm run build

# Prod Stage
FROM nginx:alpine AS production
COPY --from=builder /usr/src/app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
