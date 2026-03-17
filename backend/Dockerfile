FROM node:20-alpine AS builder

WORKDIR /workspace

# Enable corepack so pnpm is available
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests (pnpm needs all of these to resolve the lockfile)
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./package.json
COPY backend/package.json ./backend/package.json

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Compile TypeScript
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
RUN pnpm --filter cordis-backend run build

# Create a lean prod deploy folder (prod-only node_modules, no devDeps)
RUN pnpm deploy --filter cordis-backend --prod /deploy

# ── Production image ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy prod node_modules + package.json from pnpm deploy
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json

# Copy compiled output
COPY --from=builder /workspace/backend/dist ./dist

RUN mkdir -p uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
