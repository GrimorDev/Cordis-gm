# ── Stage 1: Build with Vite (fast, reliable, no Metro/Expo) ─────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (layer-cached)
COPY web/package.json ./
RUN npm install

# Copy source and build
COPY web/ .
RUN npm run build
# Output goes to ../dist (configured in vite.config.ts → outDir: '../dist')
# which inside the container is /app/../dist = /dist — so we copy from /dist below

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker-nginx.conf /etc/nginx/conf.d/mobile.conf
COPY --from=builder /dist /usr/share/nginx/html

RUN echo "ok" > /usr/share/nginx/html/health.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
