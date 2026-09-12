# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────
# NorthForge production image.
#
# Single stage build, single runtime: the Express server serves both the
# API and the built SPA, so there is one process, one port and one
# healthcheck to operate.
# ─────────────────────────────────────────────────────────────────

FROM node:20-alpine AS build
WORKDIR /app

# better-sqlite3 compiles a native addon, so build tooling is required here.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npm run build:server \
 && npm run build:seed


FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_FILE=/app/data/northforge.db

RUN addgroup -S northforge && adduser -S northforge -G northforge

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/src/schema.ts ./server/src/schema.ts

# Writable volume for the SQLite database.
RUN mkdir -p /app/data && chown -R northforge:northforge /app/data

USER northforge
EXPOSE 4000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist-server/index.js"]
