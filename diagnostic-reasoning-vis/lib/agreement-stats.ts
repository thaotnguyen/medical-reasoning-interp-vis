// ============================================================
// Inter-rater reliability statistics (pure functions)
// ============================================================

import type { RatingsStore } from "./labeling-types";
import type { Case } from "./types";
import { mapTaxonomy } from "./taxonomy-map";

/**
 * Standard (nominal) Cohen's kappa for two raters.
 * Returns NaN if no paired labels or if pe === 1.
 */
export function computeCohenKappaNominal(
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
 * Weighted Cohen's kappa (quadratic weights) for two raters on ordinal data.
 * Weight: w[i][j] = (i-j)^2 / (k-1)^2
<<<<<<< Updated upstream
 * Returns NaN if no paired labels or if expected weighted disagreement is 0.
 */
export function computeCohenKappa(
=======
 */
export function computeCohenKappaWeighted(
>>>>>>> Stashed changes
  labelsA: number[],
  labelsB: number[],
  numCategories: number
): number {
  const n = labelsA.length;
  if (n === 0 || numCategories < 2) return NaN;

  const matrix = computeConfusionMatrix(labelsA, labelsB, numCategories);
  const k = numCategories;
  const maxDist = (k - 1) * (k - 1);

<<<<<<< Updated upstream
  // Row and column marginals
=======
>>>>>>> Stashed changes
  const rowSums = new Array(k).fill(0);
  const colSums = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      rowSums[i] += matrix[i][j];
      colSums[j] += matrix[i][j];
    }
  }

<<<<<<< Updated upstream
  // Observed and expected weighted disagreement
=======
>>>>>>> Stashed changes
  let wObs = 0;
  let wExp = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const w = ((i - j) * (i - j)) / maxDist;
      wObs += w * (matrix[i][j] / n);
      wExp += w * ((rowSums[i] / n) * (colSums[j] / n));
    }
  }

  if (wExp === 0) return NaN;
  return 1 - wObs / wExp;
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
        const t = mapTaxonomy(c.sentences[si].t);
        if (t >= 0) labelB = t;
      } else {
        const rB = ratings[raterB]?.[model]?.[dataset]?.[c.id]?.[si];
        if (rB) labelB = mapTaxonomy(rB.taxonomy);
      }

      if (labelB !== undefined) {
        labelsA.push(mapTaxonomy(rA.taxonomy));
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
        if (r) {
          const mapped = mapTaxonomy(r.taxonomy);
          if (mapped >= 0 && mapped < numCategories) {
            row[mapped]++;
            count++;
          }
        }
      }

      if (includeWhitebox) {
        const mapped = mapTaxonomy(c.sentences[si].t);
        if (mapped >= 0 && mapped < numCategories) {
          row[mapped]++;
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

/**
 * Collect paired labels across ALL model/dataset combos.
 */
export function collectPairedLabelsMulti(
  ratings: RatingsStore,
  casesMap: Record<string, Case[]>,
  raterA: string,
  raterB: string | "whitebox"
): { labelsA: number[]; labelsB: number[] } {
  const labelsA: number[] = [];
  const labelsB: number[] = [];

  for (const [key, cases] of Object.entries(casesMap)) {
    const sep = key.indexOf("_");
    if (sep < 0) continue;
    const model = key.slice(0, sep);
    const dataset = key.slice(sep + 1);

    const result = collectPairedLabels(ratings, cases, model, dataset, raterA, raterB);
    labelsA.push(...result.labelsA);
    labelsB.push(...result.labelsB);
  }

  return { labelsA, labelsB };
}

/**
 * Build Fleiss matrix across ALL model/dataset combos.
 */
export function buildFleissMatrixMulti(
  ratings: RatingsStore,
  casesMap: Record<string, Case[]>,
  raterIds: string[],
  includeWhitebox: boolean,
  numCategories: number
): number[][] {
  const matrix: number[][] = [];

  for (const [key, cases] of Object.entries(casesMap)) {
    const sep = key.indexOf("_");
    if (sep < 0) continue;
    const model = key.slice(0, sep);
    const dataset = key.slice(sep + 1);

    const subMatrix = buildFleissMatrix(ratings, cases, model, dataset, raterIds, includeWhitebox, numCategories);
    matrix.push(...subMatrix);
  }

  return matrix;
}

// ============================================================
// Per-case disagreement review
// ============================================================

export interface SentenceComparison {
  sentIdx: number;
  text: string;
  labelA: number; // -1 if unlabeled
  labelB: number; // -1 if unlabeled
  agrees: boolean; // only meaningful when both >= 0
}

export interface CaseComparison {
  caseId: string;
  model: string;
  dataset: string;
  prompt: string;
  trueDx: string;
  sentences: SentenceComparison[];
  totalCompared: number;
  agreements: number;
  disagreements: number;
}

/**
 * Collect per-case comparison data across all model/dataset combos.
 * Unlike collectPairedLabelsMulti, this preserves case identity and
 * includes ALL sentences (even if only one side is labeled).
 */
export function collectCaseComparisons(
  ratings: RatingsStore,
  casesMap: Record<string, Case[]>,
  raterA: string,
  raterB: string | "whitebox"
): CaseComparison[] {
  const results: CaseComparison[] = [];

  for (const [key, cases] of Object.entries(casesMap)) {
    const sep = key.indexOf("_");
    if (sep < 0) continue;
    const model = key.slice(0, sep);
    const dataset = key.slice(sep + 1);

    for (const c of cases) {
      const ratingsA = raterA === "whitebox" ? null : ratings[raterA]?.[model]?.[dataset]?.[c.id];
      const ratingsB = raterB === "whitebox" ? null : ratings[raterB]?.[model]?.[dataset]?.[c.id];

      // Skip cases where neither source has any labels
      const aHasAny = raterA === "whitebox" || !!ratingsA;
      const bHasAny = raterB === "whitebox" || !!ratingsB;
      if (!aHasAny && !bHasAny) continue;

      const sentences: SentenceComparison[] = [];
      let totalCompared = 0;
      let agreements = 0;
      let disagreements = 0;

      for (let si = 0; si < c.sentences.length; si++) {
        const sent = c.sentences[si];

        let labelA = -1;
        if (raterA === "whitebox") {
          labelA = mapTaxonomy(sent.t);
        } else if (ratingsA?.[si]) {
          labelA = mapTaxonomy(ratingsA[si].taxonomy);
        }

        let labelB = -1;
        if (raterB === "whitebox") {
          labelB = mapTaxonomy(sent.t);
        } else if (ratingsB?.[si]) {
          labelB = mapTaxonomy(ratingsB[si].taxonomy);
        }

        const bothLabeled = labelA >= 0 && labelB >= 0;
        const agrees = bothLabeled && labelA === labelB;

        if (bothLabeled) {
          totalCompared++;
          if (agrees) agreements++;
          else disagreements++;
        }

        sentences.push({ sentIdx: si, text: sent.s, labelA, labelB, agrees });
      }

      // Only include cases with at least one compared sentence
      if (totalCompared > 0) {
        results.push({
          caseId: c.id,
          model,
          dataset,
          prompt: c.prompt,
          trueDx: c.true_dx,
          sentences,
          totalCompared,
          agreements,
          disagreements,
        });
      }
    }
  }

  // Sort by most disagreements first
  results.sort((a, b) => b.disagreements - a.disagreements);
  return results;
}

/**
 * Standard (nominal) Krippendorff's alpha, supporting variable numbers of raters per item.
 * ratingsMatrix: n_items x n_categories, each cell = count of raters who assigned that category.
 */
export function computeKrippendorffAlphaNominal(
  ratingsMatrix: number[][],
  numCategories: number
): number {
  const N = ratingsMatrix.length;
  if (N === 0) return NaN;

  const n_c: number[] = new Array(numCategories).fill(0);
  let agreedPairs = 0;
  let totalN = 0;

  for (let i = 0; i < N; i++) {
    const mi = ratingsMatrix[i].reduce((a, b) => a + b, 0);
    if (mi < 2) continue;
    totalN += mi;

    for (let c = 0; c < numCategories; c++) {
      n_c[c] += ratingsMatrix[i][c];
      agreedPairs += (ratingsMatrix[i][c] * (ratingsMatrix[i][c] - 1)) / (mi - 1);
    }
  }

  if (totalN < 2) return NaN;

  // Observed disagreement
  const D_o = 1 - agreedPairs / totalN;

  // Expected disagreement (nominal metric)
  let sumNcSquared = 0;
  for (let c = 0; c < numCategories; c++) {
    sumNcSquared += n_c[c] * n_c[c];
  }
  const D_e = (totalN * totalN - sumNcSquared) / (totalN * (totalN - 1));

  if (D_e === 0) return NaN;
  return 1 - D_o / D_e;
}

/**
 * Krippendorff's alpha for ordinal data, supporting variable numbers of raters per item.
<<<<<<< Updated upstream
 * ratingsMatrix: n_items x n_categories, each cell = count of raters who assigned that category.
 * Uses ordinal distance metric: δ²(c,k) = (Σ_{g=min(c,k)}^{max(c,k)} n_g − (n_c+n_k)/2)²
 */
export function computeKrippendorffAlpha(
=======
 * Uses ordinal distance metric: δ²(c,k) = (Σ_{g=min(c,k)}^{max(c,k)} n_g − (n_c+n_k)/2)²
 */
export function computeKrippendorffAlphaOrdinal(
>>>>>>> Stashed changes
  ratingsMatrix: number[][],
  numCategories: number
): number {
  const N = ratingsMatrix.length;
  if (N === 0 || numCategories < 2) return NaN;

<<<<<<< Updated upstream
  // First pass: compute marginal counts n_c and per-item rater counts
=======
>>>>>>> Stashed changes
  const n_c: number[] = new Array(numCategories).fill(0);
  const validItems: { row: number[]; mi: number }[] = [];
  let totalN = 0;

  for (let i = 0; i < N; i++) {
    const mi = ratingsMatrix[i].reduce((a, b) => a + b, 0);
    if (mi < 2) continue;
    totalN += mi;
    for (let c = 0; c < numCategories; c++) {
      n_c[c] += ratingsMatrix[i][c];
    }
    validItems.push({ row: ratingsMatrix[i], mi });
  }

  if (totalN < 2) return NaN;

<<<<<<< Updated upstream
  // Precompute ordinal distance matrix using marginal counts
  // δ²(c,k) = (Σ_{g=min(c,k)}^{max(c,k)} n_g − (n_c + n_k) / 2)²
=======
  // Ordinal distance matrix
>>>>>>> Stashed changes
  const delta2: number[][] = Array.from({ length: numCategories }, () =>
    new Array(numCategories).fill(0)
  );
  for (let c = 0; c < numCategories; c++) {
    for (let k = c + 1; k < numCategories; k++) {
      let cumSum = 0;
<<<<<<< Updated upstream
      for (let g = c; g <= k; g++) {
        cumSum += n_c[g];
      }
=======
      for (let g = c; g <= k; g++) cumSum += n_c[g];
>>>>>>> Stashed changes
      const d = cumSum - (n_c[c] + n_c[k]) / 2;
      delta2[c][k] = d * d;
      delta2[k][c] = d * d;
    }
  }

<<<<<<< Updated upstream
  // Observed disagreement: D_o = (1/totalN) Σ_u (1/(m_u-1)) Σ_{c<k} n_uc * n_uk * δ²(c,k)
=======
>>>>>>> Stashed changes
  let D_o = 0;
  for (const { row, mi } of validItems) {
    for (let c = 0; c < numCategories; c++) {
      for (let k = c + 1; k < numCategories; k++) {
        D_o += (row[c] * row[k] * delta2[c][k]) / (mi - 1);
      }
    }
  }
  D_o /= totalN;

<<<<<<< Updated upstream
  // Expected disagreement: D_e = (1/(totalN*(totalN-1))) Σ_{c<k} n_c * n_k * δ²(c,k)
=======
>>>>>>> Stashed changes
  let D_e = 0;
  for (let c = 0; c < numCategories; c++) {
    for (let k = c + 1; k < numCategories; k++) {
      D_e += n_c[c] * n_c[k] * delta2[c][k];
    }
  }
  D_e /= totalN * (totalN - 1);

  if (D_e === 0) return NaN;
  return 1 - D_o / D_e;
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
