/**
 * Cordis – k6 WebSocket Load Test
 *
 * Simulates concurrent Socket.IO connections (WebSocket transport).
 * Stages: ramp from 0 → 10k → 50k → 100k virtual users.
 *
 * Usage:
 *   k6 run --env BASE_URL=https://cordyn.pl --env JWT=<token> k6-websocket.js
 *
 * Install k6:  https://k6.io/docs/getting-started/installation/
 * Or via Docker:
 *   docker run --rm -i grafana/k6 run --env BASE_URL=... - < k6-websocket.js
 *
 * What each VU does:
 *   1. Opens a WebSocket connection to /socket.io/ with JWT auth
 *   2. Joins a random channel room
 *   3. Sends a typing_start event every 5 s (simulates active user)
 *   4. Stays connected for the duration of the stage
 *   5. Disconnects cleanly
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Gauge, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT      = __ENV.JWT      || '';

// Convert http(s):// to ws(s)://
const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';

// Custom metrics
const wsConnected   = new Gauge('ws_connected');
const wsMessages    = new Counter('ws_messages_received');
const wsErrors      = new Counter('ws_errors');
const wsConnectRate = new Rate('ws_connect_success');

export const options = {
  // ── Stages (ramp up → sustain → ramp down) ──────────────────────
  stages: [
    { duration: '2m',  target: 1000  },  // warm-up: 0 → 1k VUs
    { duration: '5m',  target: 10000 },  // ramp:    1k → 10k
    { duration: '5m',  target: 10000 },  // sustain: 10k
    { duration: '5m',  target: 50000 },  // ramp:    10k → 50k  ← watch heap & PG here
    { duration: '5m',  target: 50000 },  // sustain: 50k
    { duration: '5m',  target: 100000},  // ramp:    50k → 100k ← this is the target
    { duration: '10m', target: 100000},  // sustain: 100k — look for OOM / connection limits
    { duration: '3m',  target: 0     },  // ramp-down
  ],
  // ── Thresholds — test fails if these are breached ──────────────
  thresholds: {
    ws_connect_success:     ['rate>0.99'],   // 99%+ connections must succeed
    ws_errors:              ['count<100'],   // fewer than 100 WS errors total
    // p99 websocket session duration > 30 s (most VUs stayed connected)
    'ws_session_duration{scenario:default}': ['p(99)>30000'],
  },
  // ── Resource limits for the k6 process itself ─────────────────
  // Uncomment for very large tests to prevent k6 OOM:
  // noVUConnectionReuse: true,
};

// Shared channel IDs — replace with real IDs from your server
const CHANNELS = [
  'channel-id-1',
  'channel-id-2',
  'channel-id-3',
];

export default function () {
  const channelId = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
  const url = `${WS_URL}&token=${encodeURIComponent(JWT)}`;

  const res = ws.connect(url, {}, function (socket) {
    wsConnected.add(1);
    let connected = false;

    // Socket.IO handshake: server sends "0{...}" (OPEN packet)
    socket.on('open', () => {
      // Send Socket.IO CONNECT packet
      socket.send('40');
    });

    socket.on('message', (msg) => {
      wsMessages.add(1);

      if (msg.startsWith('0') && !connected) {
        // Parse sid from OPEN packet
        connected = true;
        wsConnectRate.add(true);

        // Join a channel room
        socket.send(`42["join_channel","${channelId}"]`);
      }

      // Respond to Socket.IO ping (packet type 2) with pong (3)
      if (msg === '2') socket.send('3');
    });

    socket.on('error', (e) => {
      wsErrors.add(1);
      wsConnectRate.add(false);
    });

    // Simulate active user: send typing every 5 s
    socket.setInterval(() => {
      if (connected) {
        socket.send(`42["typing_start","${channelId}"]`);
      }
    }, 5000);

    // Stay connected for a random duration (60–120 s)
    const duration = 60 + Math.random() * 60;
    sleep(duration);

    // Graceful disconnect
    socket.send(`42["leave_channel","${channelId}"]`);
    socket.close();
  });

  wsConnected.add(-1);

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });
}
