# ── Stage 1: Build Expo web export ───────────────────────────────────────────
# Use full Debian-based image (glibc) to avoid Alpine/musl issues with
# native node addons compiled during npm postinstall scripts.
FROM node:20 AS builder

WORKDIR /app

# Install deps — postinstall scripts must run (react-native-screens etc.)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Create placeholder icon so expo web export doesn't fail on missing asset.
# Real icon: add assets/icon.png to the repo and it will be used instead.
RUN mkdir -p assets && \
    node -e "require('fs').writeFileSync('assets/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64'))"

# Copy rest of the source (after install for better layer caching)
COPY . .

# Build static web export.
# baseUrl="/app" → all asset paths are prefixed with /app/
# API URL is auto-detected at runtime from window.location.origin (no env var needed)
ENV EXPO_NO_TELEMETRY=1
ENV EXPO_NO_DOTENV=1
ENV EXPO_SKIP_DOCTOR=1
ENV NODE_OPTIONS="--max-old-space-size=3072"

RUN ./node_modules/.bin/expo export --platform web

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY docker-nginx.conf /etc/nginx/conf.d/mobile.conf
COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo "ok" > /usr/share/nginx/html/health.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
