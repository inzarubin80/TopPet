const COOKIE_CONSENT_KEY = 'cookie_consent_v1';
const COOKIE_CONSENT_ACCEPTED_VALUE = 'accepted';
export const COOKIE_CONSENT_ACCEPTED_EVENT = 'cookie-consent-accepted';

export function hasCookieConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === COOKIE_CONSENT_ACCEPTED_VALUE;
  } catch {
    // In non-browser environments (tests/SSR) localStorage may be unavailable.
    return false;
  }
}

export function setCookieConsentAccepted(): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, COOKIE_CONSENT_ACCEPTED_VALUE);
  } catch {
    // ignore
  }
}

export function emitCookieConsentAccepted(): void {
  try {
    window.dispatchEvent(new Event(COOKIE_CONSENT_ACCEPTED_EVENT));
  } catch {
    // ignore
  }
}

