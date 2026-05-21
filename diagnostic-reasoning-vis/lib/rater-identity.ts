// ============================================================
// Name-based rater identity management
// The rater's name (lowercased, trimmed) IS the ID.
// Same name on any device = same rater.
// ============================================================

const RATER_NAME_KEY = "drv-rater-name";
const TUTORIAL_DONE_KEY_BASE = "drv-tutorial-done";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

function tutorialKey(pipeline?: string | null): string {
  return pipeline && pipeline !== "sentence"
    ? `${TUTORIAL_DONE_KEY_BASE}:${pipeline}`
    : TUTORIAL_DONE_KEY_BASE;
}

function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Convert a display name to a stable rater ID */
export function nameToId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getRaterName(): string | null {
  if (typeof window === "undefined") return null;
  return getCookie(RATER_NAME_KEY) ?? localStorage.getItem(RATER_NAME_KEY);
}

export function getRaterId(): string | null {
  const name = getRaterName();
  return name ? nameToId(name) : null;
}

export function isTutorialDone(pipeline?: string | null): boolean {
  if (typeof window === "undefined") return false;
  const k = tutorialKey(pipeline);
  return getCookie(k) === "1" || localStorage.getItem(k) === "1";
}

export function createRaterIdentity(
  name: string,
  pipeline?: string | null
): string {
  const trimmed = name.trim();
  const id = nameToId(trimmed);
  const k = tutorialKey(pipeline);

  // Store display name in both cookie and localStorage
  setCookie(RATER_NAME_KEY, trimmed);
  setCookie(k, "1");
  localStorage.setItem(RATER_NAME_KEY, trimmed);
  localStorage.setItem(k, "1");

  return id;
}

export function markTutorialDone(pipeline?: string | null): void {
  const k = tutorialKey(pipeline);
  setCookie(k, "1");
  localStorage.setItem(k, "1");
}
