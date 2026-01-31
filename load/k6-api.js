/**
 * k6 load test: API (public endpoints only).
 * GET /api/ping, /api/contests, /api/contests/{id}, /api/contests/{id}/participants/{pid}
 *
 * Usage:
 *   k6 run load/k6-api.js
 *   API_BASE=https://api.example.com k6 run load/k6-api.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'https://api.top-pet.ru';
const CONTEST_ID = __ENV.CONTEST_ID || 'f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb';
const PARTICIPANT_ID = __ENV.PARTICIPANT_ID || 'ca0f6ed7-41a5-49bb-9c3d-69752c65950e';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Ping
  const ping = http.get(`${API_BASE}/api/ping`);
  check(ping, { 'ping status 200': (r) => r.status === 200 });
  sleep(0.2);

  // List contests
  const contests = http.get(`${API_BASE}/api/contests`);
  check(contests, { 'contests status 200': (r) => r.status === 200 });
  sleep(0.2);

  // Contest detail
  const contest = http.get(`${API_BASE}/api/contests/${CONTEST_ID}`);
  check(contest, { 'contest status 200': (r) => r.status === 200 });
  sleep(0.2);

  // Participant detail
  const participant = http.get(
    `${API_BASE}/api/contests/${CONTEST_ID}/participants/${PARTICIPANT_ID}`
  );
  check(participant, { 'participant status 200': (r) => r.status === 200 });

  sleep(0.5);
}
