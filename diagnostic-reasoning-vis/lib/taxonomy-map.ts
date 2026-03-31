// ============================================================
// Taxonomy index remapping: 7-category (data) → 6-category (display)
//
// Data files and human ratings store the original 7-category indices.
// The UI displays a merged/reordered 6-category taxonomy.
// This module provides the mapping applied at read boundaries.
//
// Old (0-6) → New (0-5):
//   0 Orchestration              → 0 Orchestration
//   1 Case Evidence Extraction   → 1 Case Evidence
//   2 Evidence Processing        → 1 Case Evidence  (merged)
//   3 Recalling Medical Knowledge→ 4 Recalling Medical Knowledge (moved)
//   4 Hypothesis Generation      → 2 Hypothesis Generation
//   5 Hypothesis Evaluation      → 3 Hypothesis Evaluation
//   6 Final Answer               → 5 Final Answer
// ============================================================

const REMAP: readonly number[] = [0, 1, 1, 4, 2, 3, 5];

/** Number of display categories */
export const DISPLAY_NUM_CATEGORIES = 6;

/**
 * Map a stored 7-category taxonomy index to a display 6-category index.
 * Returns -1 for unlabeled/invalid values.
 */
export function mapTaxonomy(stored: number): number {
  if (stored < 0 || stored >= REMAP.length) return -1;
  return REMAP[stored];
}

/**
 * Reverse map: display 6-category index → stored 7-category index.
 * For merged "Case Evidence" (display 1), stores as old 1 (extraction).
 */
const REVERSE: readonly number[] = [0, 1, 4, 5, 3, 6];

export function unmapTaxonomy(display: number): number {
  if (display < 0 || display >= REVERSE.length) return -1;
  return REVERSE[display];
}
