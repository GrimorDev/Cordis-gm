#!/bin/sh
set -e

USER="${POSTGRESQL_USERNAME:-cordis}"
PASS="${POSTGRESQL_PASSWORD:-cordis_secret}"
HOST="${POSTGRESQL_HOST:-postgres}"
PORT="${POSTGRESQL_PORT:-5432}"
DB="${POSTGRESQL_DATABASE:-cordis}"

# Generate MD5 password hash: md5(password + username)
MD5HASH=$(printf '%s%s' "$PASS" "$USER" | md5sum | cut -d' ' -f1)

mkdir -p /etc/pgbouncer

cat > /etc/pgbouncer/userlist.txt << EOF
"$USER" "md5$MD5HASH"
EOF

cat > /etc/pgbouncer/pgbouncer.ini << EOF
[databases]
$DB = host=$HOST port=$PORT dbname=$DB

[pgbouncer]
listen_port   = ${PGBOUNCER_PORT:-5432}
listen_addr   = 0.0.0.0
auth_type     = md5
auth_file     = /etc/pgbouncer/userlist.txt
pool_mode     = ${PGBOUNCER_POOL_MODE:-transaction}
max_client_conn      = ${PGBOUNCER_MAX_CLIENT_CONN:-5000}
default_pool_size    = ${PGBOUNCER_DEFAULT_POOL_SIZE:-50}
min_pool_size        = ${PGBOUNCER_MIN_POOL_SIZE:-5}
reserve_pool_size    = ${PGBOUNCER_RESERVE_POOL_SIZE:-10}
reserve_pool_timeout = ${PGBOUNCER_RESERVE_POOL_TIMEOUT:-5}
server_idle_timeout  = ${PGBOUNCER_SERVER_IDLE_TIMEOUT:-600}
client_idle_timeout  = ${PGBOUNCER_CLIENT_IDLE_TIMEOUT:-60}
log_connections      = ${PGBOUNCER_LOG_CONNECTIONS:-0}
log_disconnections   = ${PGBOUNCER_LOG_DISCONNECTIONS:-0}
log_pooler_errors    = 1
EOF

echo "[pgbouncer] Starting: $USER@$HOST:$PORT/$DB pool_mode=${PGBOUNCER_POOL_MODE:-transaction} max_client_conn=${PGBOUNCER_MAX_CLIENT_CONN:-5000}"
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
