/**
 * k6 load test: API chain "open contest page" (contest + participants list).
 * Then "open participant page" (participant + comments).
 * Simulates what the frontend requests when loading contest and participant pages.
 *
 * Usage:
 *   k6 run load/k6-scenario-contest-flow.js
 *   API_BASE=https://api.top-pet.ru k6 run load/k6-scenario-contest-flow.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'https://api.top-pet.ru';
const CONTEST_ID = __ENV.CONTEST_ID || 'f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb';
const PARTICIPANT_ID = __ENV.PARTICIPANT_ID || 'ca0f6ed7-41a5-49bb-9c3d-69752c65950e';

export const options = {
  vus: 15,
  duration: '45s',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Chain 1: open contest page — contest detail + participants list
  const contest = http.get(`${API_BASE}/api/contests/${CONTEST_ID}`);
  check(contest, { 'contest 200': (r) => r.status === 200 });
  sleep(0.1);

  const participants = http.get(`${API_BASE}/api/contests/${CONTEST_ID}/participants`);
  check(participants, { 'participants list 200': (r) => r.status === 200 });
  sleep(0.5 + Math.random() * 1);

  // Chain 2: open participant page — participant detail + comments
  const participant = http.get(
    `${API_BASE}/api/contests/${CONTEST_ID}/participants/${PARTICIPANT_ID}`
  );
  check(participant, { 'participant 200': (r) => r.status === 200 });
  sleep(0.1);

  const comments = http.get(
    `${API_BASE}/api/participants/${PARTICIPANT_ID}/comments?limit=20`
  );
  check(comments, { 'comments 200': (r) => r.status === 200 });

  sleep(1 + Math.random() * 2);
}
