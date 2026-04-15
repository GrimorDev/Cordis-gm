/**
 * Cordis – k6 HTTP API Load Test
 *
 * Simulates realistic API traffic patterns:
 *   - 60% GET requests (messages, servers, users)
 *   - 30% POST requests (send message)
 *   - 10% PUT/PATCH requests (read receipts, reactions)
 *
 * Usage:
 *   k6 run --env BASE_URL=https://cordyn.pl --env JWT=<token> \
 *           --env CHANNEL_ID=<id> --env SERVER_ID=<id> k6-http.js
 *
 * Quickstart (10k VUs for 2 min):
 *   k6 run --vus 10000 --duration 2m \
 *     --env BASE_URL=http://localhost:3000 --env JWT=eyJhbGc... k6-http.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const JWT        = __ENV.JWT        || '';
const CHANNEL_ID = __ENV.CHANNEL_ID || '';
const SERVER_ID  = __ENV.SERVER_ID  || '';

const API = `${BASE_URL}/api`;

const errorRate      = new Rate('http_error_rate');
const messageDuration = new Trend('message_send_duration', true);

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${JWT}`,
};

export const options = {
  stages: [
    { duration: '1m',  target: 500   },
    { duration: '3m',  target: 5000  },
    { duration: '3m',  target: 5000  },  // sustain 5k RPS
    { duration: '3m',  target: 20000 },
    { duration: '5m',  target: 20000 },  // sustain 20k RPS
    { duration: '2m',  target: 0     },
  ],
  thresholds: {
    http_req_duration:    ['p(95)<500', 'p(99)<1500'],  // 95th pct < 500ms
    http_req_failed:      ['rate<0.01'],                // <1% errors
    http_error_rate:      ['rate<0.01'],
    message_send_duration:['p(95)<800'],
  },
};

// ── Scenario weights ──────────────────────────────────────────────────
function weightedChoice() {
  const r = Math.random();
  if (r < 0.35) return 'getMessages';
  if (r < 0.55) return 'getServer';
  if (r < 0.70) return 'getNotifications';
  if (r < 0.85) return 'sendMessage';
  if (r < 0.92) return 'getUser';
  return 'markNotifRead';
}

export default function () {
  const scenario = weightedChoice();
  let res;

  switch (scenario) {
    case 'getMessages':
      // Hot path — cached in Redis after first hit
      res = http.get(`${API}/messages/channel/${CHANNEL_ID}`, { headers: HEADERS });
      check(res, { 'messages 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 400);
      break;

    case 'getServer':
      res = http.get(`${API}/servers/${SERVER_ID}`, { headers: HEADERS });
      check(res, { 'server 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 400);
      break;

    case 'getNotifications':
      res = http.get(`${API}/notifications/unread-count`, { headers: HEADERS });
      check(res, { 'notif 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 400);
      break;

    case 'sendMessage':
      const start = Date.now();
      res = http.post(
        `${API}/messages/channel/${CHANNEL_ID}`,
        JSON.stringify({ content: `Load test message ${Date.now()}` }),
        { headers: HEADERS }
      );
      messageDuration.add(Date.now() - start);
      check(res, { 'message sent 201': (r) => r.status === 201 });
      errorRate.add(res.status >= 400);
      break;

    case 'getUser':
      res = http.get(`${API}/users/me`, { headers: HEADERS });
      check(res, { 'user 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 400);
      break;

    case 'markNotifRead':
      res = http.put(`${API}/notifications/read`, null, { headers: HEADERS });
      check(res, { 'read 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 400);
      break;
  }

  // Think time: 0.5–2 s between requests (realistic user pacing)
  sleep(0.5 + Math.random() * 1.5);
}
