FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package.json ./package.json
RUN npm install

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN node_modules/.bin/tsc

# ── Production image ──────────────────────────────────────────────────
# node:20-slim (Debian Bookworm) provides glibc required by the yt-dlp
# standalone binary (which bundles its own Python via PyInstaller).
FROM node:20-slim

WORKDIR /app

# Install ffmpeg (audio transcoding) + curl (healthcheck + yt-dlp download)
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    ffmpeg curl ca-certificates && \
    curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
         -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
