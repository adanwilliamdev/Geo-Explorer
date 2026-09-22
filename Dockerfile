# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# O servidor não roda como usuário root no container
RUN addgroup -S geoexplorer && adduser -S geoexplorer -G geoexplorer
USER geoexplorer

# O servidor MCP se comunica via stdio, não expõe porta HTTP.
# Rode com: docker run -i --rm geo-explorer
ENTRYPOINT ["node", "dist/index.js"]
