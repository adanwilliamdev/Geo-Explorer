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

LABEL org.opencontainers.image.title="geo-explorer" \
      org.opencontainers.image.description="Servidor MCP de trilhas de aprendizagem, desafios e certificados"

WORKDIR /app
ENV NODE_ENV=production \
    GEO_DATA_DIR=/data

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# O servidor não roda como root. /data guarda progresso, certificados e o segredo de assinatura.
RUN addgroup -S geoexplorer && adduser -S geoexplorer -G geoexplorer \
    && mkdir -p /data && chown geoexplorer:geoexplorer /data
USER geoexplorer
VOLUME ["/data"]

# O servidor MCP se comunica via stdio, não expõe porta HTTP.
# Rode com: docker run -i --rm -v geo-data:/data geo-explorer
ENTRYPOINT ["node", "dist/index.js"]
