// ============================================================
// Inter-rater reliability statistics (pure functions)
// ============================================================

import type { RatingsStore } from "./labeling-types";
import type { Case } from "./types";

/**
 * Cohen's kappa for two raters.
 * Returns NaN if no paired labels or if pe === 1.
 */
export function computeCohenKappa(
  labelsA: number[],
  labelsB: number[],
  numCategories: number
): number {
  const n = labelsA.length;
  if (n === 0) return NaN;

  const matrix = computeConfusionMatrix(labelsA, labelsB, numCategories);

  // Observed agreement
  let agree = 0;
  for (let i = 0; i < numCategories; i++) {
    agree += matrix[i][i];
  }
  const po = agree / n;

  // Expected agreement by chance
  let pe = 0;
  for (let k = 0; k < numCategories; k++) {
    let rowSum = 0;
    let colSum = 0;
    for (let j = 0; j < numCategories; j++) {
      rowSum += matrix[k][j];
      colSum += matrix[j][k];
    }
    pe += (rowSum / n) * (colSum / n);
  }

  if (pe === 1) return NaN;
  return (po - pe) / (1 - pe);
}

/**
 * Fleiss' kappa for 3+ raters.
 * ratingsMatrix: n_items x n_categories, each cell = count of raters who assigned that category.
 */
export function computeFleissKappa(
  ratingsMatrix: number[][],
  numCategories: number
): number {
  const N = ratingsMatrix.length; // number of items
  if (N === 0) return NaN;

  const n = ratingsMatrix[0].reduce((a, b) => a + b, 0); // raters per item
  if (n <= 1) return NaN;

  // Proportion of assignments to each category
  const pj: number[] = new Array(numCategories).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < numCategories; j++) {
      pj[j] += ratingsMatrix[i][j];
    }
  }
  for (let j = 0; j < numCategories; j++) {
    pj[j] /= N * n;
  }

  // P_i for each item
  let Pbar = 0;
  for (let i = 0; i < N; i++) {
    let Pi = 0;
    for (let j = 0; j < numCategories; j++) {
      Pi += ratingsMatrix[i][j] * ratingsMatrix[i][j];
    }
    Pi = (Pi - n) / (n * (n - 1));
    Pbar += Pi;
  }
  Pbar /= N;

  // Pe
  let Pe = 0;
  for (let j = 0; j < numCategories; j++) {
    Pe += pj[j] * pj[j];
  }

  if (Pe === 1) return NaN;
  return (Pbar - Pe) / (1 - Pe);
}

/**
 * NxN confusion matrix.
 */
export function computeConfusionMatrix(
  labelsA: number[],
  labelsB: number[],
  numCategories: number
): number[][] {
  const matrix: number[][] = Array.from({ length: numCategories }, () =>
    new Array(numCategories).fill(0)
  );
  for (let i = 0; i < labelsA.length; i++) {
    const a = labelsA[i];
    const b = labelsB[i];
    if (a >= 0 && a < numCategories && b >= 0 && b < numCategories) {
      matrix[a][b]++;
    }
  }
  return matrix;
}

/**
 * Per-category precision, recall, F1 for labelsA (reference) vs labelsB (predicted).
 */
export function computeCategoryMetrics(
  labelsA: number[],
  labelsB: number[],
  numCategories: number
): { category: number; agreement: number; precision: number; recall: number; f1: number }[] {
  const matrix = computeConfusionMatrix(labelsA, labelsB, numCategories);
  const results = [];

  for (let k = 0; k < numCategories; k++) {
    let tp = matrix[k][k];
    let rowSum = 0; // actual positives
    let colSum = 0; // predicted positives
    for (let j = 0; j < numCategories; j++) {
      rowSum += matrix[k][j];
      colSum += matrix[j][k];
    }

    const precision = colSum > 0 ? tp / colSum : 0;
    const recall = rowSum > 0 ? tp / rowSum : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const agreement = labelsA.length > 0 ? tp / labelsA.length : 0;

    results.push({ category: k, agreement, precision, recall, f1 });
  }

  return results;
}

/**
 * Collect aligned label arrays for sentences where both sources have labeled.
 * sourceB = "whitebox" means use the original sentence.t field.
 */
export function collectPairedLabels(
  ratings: RatingsStore,
  cases: Case[],
  model: string,
  dataset: string,
  raterA: string,
  raterB: string | "whitebox"
): { labelsA: number[]; labelsB: number[] } {
  const labelsA: number[] = [];
  const labelsB: number[] = [];

  for (const c of cases) {
    const ratingsA = ratings[raterA]?.[model]?.[dataset]?.[c.id];
    if (!ratingsA) continue;

    for (let si = 0; si < c.sentences.length; si++) {
      const rA = ratingsA[si];
      if (!rA) continue;

      let labelB: number | undefined;
      if (raterB === "whitebox") {
        const t = c.sentences[si].t;
        if (t >= 0) labelB = t;
      } else {
        const rB = ratings[raterB]?.[model]?.[dataset]?.[c.id]?.[si];
        if (rB) labelB = rB.taxonomy;
      }

      if (labelB !== undefined) {
        labelsA.push(rA.taxonomy);
        labelsB.push(labelB);
      }
    }
  }

  return { labelsA, labelsB };
}

/**
 * Build the Fleiss kappa ratings matrix from all raters + optionally whitebox.
 */
export function buildFleissMatrix(
  ratings: RatingsStore,
  cases: Case[],
  model: string,
  dataset: string,
  raterIds: string[],
  includeWhitebox: boolean,
  numCategories: number
): number[][] {
  const matrix: number[][] = [];

  for (const c of cases) {
    for (let si = 0; si < c.sentences.length; si++) {
      const row = new Array(numCategories).fill(0);
      let count = 0;

      for (const raterId of raterIds) {
        const r = ratings[raterId]?.[model]?.[dataset]?.[c.id]?.[si];
        if (r && r.taxonomy >= 0 && r.taxonomy < numCategories) {
          row[r.taxonomy]++;
          count++;
        }
      }

      if (includeWhitebox) {
        const t = c.sentences[si].t;
        if (t >= 0 && t < numCategories) {
          row[t]++;
          count++;
        }
      }

      // Only include items with 2+ raters
      if (count >= 2) {
        matrix.push(row);
      }
    }
  }

  return matrix;
}

export function interpretKappa(kappa: number): {
  label: string;
  color: string;
} {
  if (isNaN(kappa)) return { label: "N/A", color: "#94a3b8" };
  if (kappa < 0) return { label: "Poor", color: "#ef4444" };
  if (kappa < 0.2) return { label: "Slight", color: "#f97316" };
  if (kappa < 0.4) return { label: "Fair", color: "#eab308" };
  if (kappa < 0.6) return { label: "Moderate", color: "#a3e635" };
  if (kappa < 0.8) return { label: "Substantial", color: "#22c55e" };
  return { label: "Almost Perfect", color: "#16a34a" };
}
