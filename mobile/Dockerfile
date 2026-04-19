# ── Stage 1: Build Expo web export ───────────────────────────────────────────
FROM node:20-alpine AS builder

# Native build tools required by some npm postinstall scripts (react-native-screens etc.)
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Install deps (layer-cached); postinstall scripts must run for some RN packages
COPY package.json ./
RUN npm install --legacy-peer-deps

# Create placeholder icon (real icon can be added to assets/ in the repo later)
RUN mkdir -p assets && \
    node -e "require('fs').writeFileSync('assets/icon.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64'))"

# Copy rest of source (after npm install for better layer caching)
COPY . .

# Build static web export
# experiments.baseUrl="/app" → all asset paths are /app/...
# API URL is auto-detected from window.location.origin at runtime (no build-time env needed)
ENV CI=1
ENV EXPO_NO_TELEMETRY=1
ENV EXPO_NO_DOTENV=1
# Give Metro bundler enough heap on constrained build hosts
ENV NODE_OPTIONS="--max-old-space-size=3072"

RUN npx expo export --platform web

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
