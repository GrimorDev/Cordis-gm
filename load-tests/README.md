# Cordis Load Tests (k6)

## Install k6

```bash
# Linux/macOS
brew install k6

# Docker (no install needed)
docker pull grafana/k6
```

## Run WebSocket test (100k concurrent connections)

```bash
# Local
k6 run \
  --env BASE_URL=https://cordyn.pl \
  --env JWT=<your-jwt-token> \
  load-tests/k6-websocket.js

# Docker
docker run --rm -i grafana/k6 run \
  --env BASE_URL=https://cordyn.pl \
  --env JWT=<token> \
  - < load-tests/k6-websocket.js
```

## Run HTTP API test

```bash
k6 run \
  --env BASE_URL=https://cordyn.pl \
  --env JWT=<token> \
  --env CHANNEL_ID=<uuid> \
  --env SERVER_ID=<uuid> \
  load-tests/k6-http.js
```

## Quick smoke test (100 VUs, 30 s)

```bash
k6 run --vus 100 --duration 30s \
  --env BASE_URL=http://localhost:3000 \
  --env JWT=<token> \
  --env CHANNEL_ID=<uuid> \
  --env SERVER_ID=<uuid> \
  load-tests/k6-http.js
```

## Interpreting results

| Metric | Target at 100k |
|--------|---------------|
| `http_req_duration p(95)` | < 500 ms |
| `http_req_duration p(99)` | < 1 500 ms |
| `http_req_failed rate` | < 1% |
| `ws_connect_success rate` | > 99% |
| `ws_errors count` | < 100 total |

## What to watch during the test

1. **Grafana** → Cordis Overview dashboard (`http://your-server:3001`)
2. **Redis hit rate** — should be > 80% under load
3. **PG pool waiting** — must stay near 0 (PgBouncer absorbs spikes)
4. **Node.js heap** — should not exceed 80% of NODE_MAX_OLD_SPACE
5. **Host CPU** — if > 70%, add more CLUSTER_WORKERS or scale horizontally
