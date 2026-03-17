FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (npm ships with node:alpine; no extra tooling needed)
COPY backend/package.json ./package.json
RUN npm install

# Compile TypeScript
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN node_modules/.bin/tsc

# ── Production image ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
