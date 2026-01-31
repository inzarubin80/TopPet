/**
 * k6 ramp-up / stress test: find approximate capacity (concurrent users).
 * Increases VUs in stages; no thresholds so test runs to end.
 * Check output for when http_req_failed > 0 or p95 spikes.
 *
 * Usage:
 *   k6 run load/k6-ramp-up.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'https://api.top-pet.ru';
const FRONT_BASE = __ENV.FRONT_BASE || 'https://top-pet.ru';
const CONTEST_ID = __ENV.CONTEST_ID || 'f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb';
const PARTICIPANT_ID = __ENV.PARTICIPANT_ID || 'ca0f6ed7-41a5-49bb-9c3d-69752c65950e';

export const options = {
  stages: [
    { duration: '1m', target: 30 },   // 0–1 min: 30 VU
    { duration: '1m', target: 60 },   // 1–2 min: 60 VU
    { duration: '1m', target: 100 }, // 2–3 min: 100 VU
    { duration: '1m', target: 150 },  // 3–4 min: 150 VU
    { duration: '1m', target: 200 },  // 4–5 min: 200 VU
    { duration: '1m', target: 250 }, // 5–6 min: 250 VU
    { duration: '1m', target: 300 },  // 6–7 min: 300 VU
    { duration: '1m', target: 350 },  // 7–8 min: 350 VU
    { duration: '1m', target: 400 },  // 8–9 min: 400 VU
    { duration: '1m', target: 450 },  // 9–10 min: 450 VU
    { duration: '1m', target: 500 },   // 10–11 min: 500 VU
    { duration: '1m', target: 600 },   // 11–12 min: 600 VU
    { duration: '1m', target: 700 },   // 12–13 min: 700 VU
    { duration: '1m', target: 800 },   // 13–14 min: 800 VU
    { duration: '1m', target: 900 },   // 14–15 min: 900 VU
    { duration: '1m', target: 1000 }, // 15–16 min: 1000 VU
    { duration: '1m', target: 0 },    // ramp down
  ],
  // No thresholds — we want to see when things break
};

export default function () {
  // API
  const ping = http.get(`${API_BASE}/api/ping`);
  check(ping, { 'ping 200': (r) => r.status === 200 });
  sleep(0.1);

  const contest = http.get(`${API_BASE}/api/contests/${CONTEST_ID}`);
  check(contest, { 'contest 200': (r) => r.status === 200 });
  sleep(0.1);

  // Frontend page
  const page = http.get(`${FRONT_BASE}/contests/${CONTEST_ID}`);
  check(page, { 'page 200': (r) => r.status === 200 });

  sleep(0.3 + Math.random() * 0.5);
}
