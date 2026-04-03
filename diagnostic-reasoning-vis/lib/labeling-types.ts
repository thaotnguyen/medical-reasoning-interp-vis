// ============================================================
// Types and constants for human sentence labeling
// ============================================================

/** Rater ID is a UUID string, generated per-user via cookie */
export type RaterId = string;

export interface SentenceRating {
  taxonomy: number; // 0-6 matching whitebox taxonomy indices
  timestamp: number; // Date.now() when labeled
}

/**
 * Nested record: raterId -> model -> dataset -> caseId -> sentenceIndex -> rating
 * Sentence index is 0-based (matching array position).
 */
export type RatingsStore = Record<
  string,
  Record<string, Record<string, Record<string, Record<number, SentenceRating>>>>
>;

/** Server response shape: raterId -> { name, ratings } */
export type ServerRatingsResponse = Record<
  string,
  { name: string; ratings: RatingsStore[string] }
>;

/** Cached info about a case in the sample pool */
export interface CasePoolInfo {
  sentenceCount: number;
  caseId: string;
}

/** Maps keyboard keys "1"-"7" to taxonomy indices 0-6 */
export const TAXONOMY_KEYBOARD_MAP: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
};

/** Colors assigned to raters in the agreement dashboard */
export const RATER_COLORS = [
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
];
