FROM node:20-slim AS builder

WORKDIR /app

# MediaSoup requires Python3 + C++ build tools to compile its native addon
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    python3 make g++ linux-headers-generic \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./package.json
RUN npm install

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN node_modules/.bin/tsc

# ── Production image ──────────────────────────────────────────────────
# node:20-slim (Debian Bookworm) provides glibc required by the yt-dlp
# standalone binary (which bundles its own Python via PyInstaller).
# Also needed for mediasoup native addon at runtime.
FROM node:20-slim

WORKDIR /app

# Install ffmpeg (audio transcoding) + curl (healthcheck + yt-dlp download)
# + Python3/g++/make for mediasoup native module (must be present at runtime too)
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    ffmpeg curl wget ca-certificates python3 make g++ && \
    curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
         -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./package.json
# Install ALL deps including mediasoup (needs to compile native addon in this image)
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
RUN mkdir -p uploads/avatars uploads/banners

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
