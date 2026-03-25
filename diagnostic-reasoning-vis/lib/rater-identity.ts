// ============================================================
// Cookie-based rater identity management
// ============================================================

const RATER_ID_KEY = "drv-rater-id";
const RATER_NAME_KEY = "drv-rater-name";
const TUTORIAL_DONE_KEY = "drv-tutorial-done";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getRaterId(): string | null {
  if (typeof window === "undefined") return null;
  return getCookie(RATER_ID_KEY) ?? localStorage.getItem(RATER_ID_KEY);
}

export function getRaterName(): string | null {
  if (typeof window === "undefined") return null;
  return getCookie(RATER_NAME_KEY) ?? localStorage.getItem(RATER_NAME_KEY);
}

export function isTutorialDone(): boolean {
  if (typeof window === "undefined") return false;
  return getCookie(TUTORIAL_DONE_KEY) === "1" || localStorage.getItem(TUTORIAL_DONE_KEY) === "1";
}

export function createRaterIdentity(name: string): string {
  const id = crypto.randomUUID();

  // Store in both cookie and localStorage for redundancy
  setCookie(RATER_ID_KEY, id);
  setCookie(RATER_NAME_KEY, name);
  setCookie(TUTORIAL_DONE_KEY, "1");
  localStorage.setItem(RATER_ID_KEY, id);
  localStorage.setItem(RATER_NAME_KEY, name);
  localStorage.setItem(TUTORIAL_DONE_KEY, "1");

  return id;
}

export function markTutorialDone(): void {
  setCookie(TUTORIAL_DONE_KEY, "1");
  localStorage.setItem(TUTORIAL_DONE_KEY, "1");
}
