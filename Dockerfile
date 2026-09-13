# syntax=docker/dockerfile:1
ARG NODE_VERSION=18-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

FROM base AS prod-deps
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Production image: compiled JS only, non-root, tini-style signal handling via
# `node` as PID 1 (Node handles SIGTERM itself; see src/main.ts shutdown).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS production
ARG APP_RELEASE=dev
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads \
    APP_RELEASE=${APP_RELEASE} \
    NODE_OPTIONS=--enable-source-maps

RUN apk add --no-cache curl \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

COPY --chown=node:node package*.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/v1/health/live || exit 1

CMD ["node", "dist/main.js"]
