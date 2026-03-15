FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy lockfile + manifest first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install only frontend deps (ignore workspace packages like backend)
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

# Build Vite app
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN pnpm build

# ── Nginx image ───────────────────────────────────────────────────────
FROM nginx:1.25-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/cordis.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Plik healthcheck
RUN echo "ok" > /usr/share/nginx/html/health.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
