/**
 * k6 load test: Frontend pages (SPA).
 * Main page, contest page, participant page.
 * Includes "user journey" scenario: main -> contest -> participant.
 *
 * Usage:
 *   k6 run load/k6-frontend.js
 *   FRONT_BASE=https://top-pet.ru k6 run load/k6-frontend.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const FRONT_BASE = __ENV.FRONT_BASE || 'https://top-pet.ru';
const CONTEST_ID = __ENV.CONTEST_ID || 'f4ba61d5-9ce4-411a-a533-2e90c4e1e3eb';
const PARTICIPANT_ID = __ENV.PARTICIPANT_ID || 'ca0f6ed7-41a5-49bb-9c3d-69752c65950e';

const MAIN_URL = `${FRONT_BASE}/`;
const CONTEST_URL = `${FRONT_BASE}/contests/${CONTEST_ID}`;
const PARTICIPANT_URL = `${FRONT_BASE}/contests/${CONTEST_ID}/participants/${PARTICIPANT_ID}`;

export const options = {
  scenarios: {
    // Mixed: hit each page type
    hit_main: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      exec: 'hitMain',
    },
    hit_contest: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      exec: 'hitContest',
    },
    hit_participant: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      exec: 'hitParticipant',
    },
    // User journey: main -> contest -> participant
    user_journey: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '0s',
      exec: 'userJourney',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function hitMain() {
  const r = http.get(MAIN_URL);
  check(r, { 'main status 200': (res) => res.status === 200 });
  sleep(0.5 + Math.random() * 1);
}

export function hitContest() {
  const r = http.get(CONTEST_URL);
  check(r, { 'contest status 200': (res) => res.status === 200 });
  sleep(0.5 + Math.random() * 1);
}

export function hitParticipant() {
  const r = http.get(PARTICIPANT_URL);
  check(r, { 'participant status 200': (res) => res.status === 200 });
  sleep(0.5 + Math.random() * 1);
}

export function userJourney() {
  const main = http.get(MAIN_URL);
  check(main, { 'journey main 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);

  const contest = http.get(CONTEST_URL);
  check(contest, { 'journey contest 200': (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);

  const participant = http.get(PARTICIPANT_URL);
  check(participant, { 'journey participant 200': (r) => r.status === 200 });

  sleep(2 + Math.random() * 3);
}
