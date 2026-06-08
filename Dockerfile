FROM node:22-alpine AS builder

# Pin pnpm to v9 — same as CI; avoids pnpm 10/11 breaking changes
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy lockfile + manifest first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install only frontend deps.
# --no-frozen-lockfile: tolerates minor lockfile drift between commits
# (scripts allowed via .npmrc dangerously-allow-all-builds=true)
RUN pnpm install --no-frozen-lockfile

COPY . .

# Build Vite app
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ARG VITE_DESKTOP_DOWNLOAD_URL=
ARG VITE_VAPID_PUBLIC_KEY=
# LiveKit WS URL — leave empty to auto-derive from window.location (recommended)
# Set explicitly only if LiveKit is behind a different domain/port than the frontend.
ARG VITE_LIVEKIT_URL=
# TURN relay for the WebRTC mesh — see docker-compose.yml `coturn` service.
# Without this, calls between peers behind symmetric NAT/CGNAT/strict
# firewalls fail to connect (STUN alone isn't enough).
ARG VITE_TURN_URL=
ARG VITE_TURN_USERNAME=
ARG VITE_TURN_CREDENTIAL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_DESKTOP_DOWNLOAD_URL=$VITE_DESKTOP_DOWNLOAD_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_LIVEKIT_URL=$VITE_LIVEKIT_URL
ENV VITE_TURN_URL=$VITE_TURN_URL
ENV VITE_TURN_USERNAME=$VITE_TURN_USERNAME
ENV VITE_TURN_CREDENTIAL=$VITE_TURN_CREDENTIAL

RUN pnpm build

# ── Nginx image ───────────────────────────────────────────────────────
FROM nginx:1.25-alpine

RUN rm /etc/nginx/conf.d/default.conf

# Replace default global nginx.conf (worker_connections, keepalive, rate-limit zones)
COPY nginx-main.conf /etc/nginx/nginx.conf
# Server block
COPY nginx.conf /etc/nginx/conf.d/cordis.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Plik healthcheck
RUN echo "ok" > /usr/share/nginx/html/health.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
