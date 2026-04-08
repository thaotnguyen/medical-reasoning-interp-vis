// ============================================================
// Ranked pool selection for the sentence labeler
// ============================================================

export interface TrainingPoolEntry {
  model: string;
  dataset: string;
  caseIndex: number;
  isTraining: true;
}

export interface RankedCaseCandidate {
  model: string;
  dataset: string;
  pmcid: string;
  questionId: string | number | null;
  prompt: string;
  sentenceCount: number;
  agreementKappa: number;
  caseIndex: number;
}

export interface PoolSelectionEntry {
  model: string;
  dataset: string;
  caseIndex: number;
  pmcid: string;
  sentenceCount: number;
  agreementKappa: number | null;
}

export type LabelerPoolTestEntry = PoolSelectionEntry;

export interface LabelerPoolManifest {
  training: TrainingPoolEntry[];
  test: LabelerPoolTestEntry[];
}

export interface CellTarget {
  model: string;
  dataset: string;
  count: number;
}

export interface IndexedPoolItem {
  index: number;
  model: string;
  dataset: string;
  caseIndex: number;
  isTraining?: boolean;
  pmcid?: string;
  sentenceCount?: number;
  agreementKappa?: number | null;
}

export interface RequiredCell {
  model: string;
  dataset: string;
}

export interface SelectCasesWithCoverageArgs {
  fixedCases: readonly PoolSelectionEntry[];
  scoredCandidates: readonly RankedCaseCandidate[];
  fallbackCandidates: readonly PoolSelectionEntry[];
  requiredCells: readonly RequiredCell[];
  maxCases: number;
  datasetOrder: readonly string[];
  modelTargets?: Readonly<Record<string, number>>;
  datasetTargets?: Readonly<Record<string, number>>;
}

export interface TraceLike {
  pmcid?: unknown;
  question_id?: unknown;
  case_prompt?: unknown;
  label_json?: Record<string, { sentence?: unknown } | undefined> | null;
  sequence?: unknown;
}

export interface BuildCaseCandidateArgs {
  model: string;
  dataset: string;
  whiteTrace: TraceLike;
  blackTrace: TraceLike;
}

export const TRAINING_CASES: TrainingPoolEntry[] = [
  {
    model: "claude-3-7-sonnet-20250219",
    dataset: "medqa",
    caseIndex: 0,
    isTraining: true,
  },
  {
    model: "qwq-32b",
    dataset: "medmcqa-filtered",
    caseIndex: 0,
    isTraining: true,
  },
  {
    model: "gpt-oss-20b",
    dataset: "nejm-cpc",
    caseIndex: 0,
    isTraining: true,
  },
];

function normalizePmcid(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeQuestionId(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export function orderedTraceSentences(trace: TraceLike): string[] {
  if (!trace.label_json || typeof trace.label_json !== "object") return [];
  return Object.entries(trace.label_json)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, value]) => normalizeText(value?.sentence));
}

export function orderedTraceSequence(trace: TraceLike): number[] | null {
  if (!Array.isArray(trace.sequence)) return null;
  const sequence = trace.sequence.map((value) => Number(value));
  return sequence.every((value) => Number.isInteger(value)) ? sequence : null;
}

export function computeCohenKappa(labelsA: number[], labelsB: number[]): number {
  if (labelsA.length === 0 || labelsA.length !== labelsB.length) return Number.NaN;

  let agreements = 0;
  const countsA = new Map<number, number>();
  const countsB = new Map<number, number>();

  for (let i = 0; i < labelsA.length; i++) {
    const labelA = labelsA[i];
    const labelB = labelsB[i];
    if (labelA === labelB) agreements++;
    countsA.set(labelA, (countsA.get(labelA) ?? 0) + 1);
    countsB.set(labelB, (countsB.get(labelB) ?? 0) + 1);
  }

  const observed = agreements / labelsA.length;
  const labels = new Set<number>([...countsA.keys(), ...countsB.keys()]);

  let expected = 0;
  for (const label of labels) {
    expected +=
      ((countsA.get(label) ?? 0) / labelsA.length) *
      ((countsB.get(label) ?? 0) / labelsB.length);
  }

  if (expected === 1) return Number.NaN;
  return (observed - expected) / (1 - expected);
}

export function buildCaseCandidateFromTraces({
  model,
  dataset,
  whiteTrace,
  blackTrace,
}: BuildCaseCandidateArgs): Omit<RankedCaseCandidate, "caseIndex"> | null {
  const whitePmcid = normalizePmcid(whiteTrace.pmcid);
  const blackPmcid = normalizePmcid(blackTrace.pmcid);
  if (!whitePmcid || whitePmcid !== blackPmcid) return null;

  const whiteSentences = orderedTraceSentences(whiteTrace);
  const blackSentences = orderedTraceSentences(blackTrace);

  if (
    whiteSentences.length <= 10 ||
    blackSentences.length <= 10 ||
    whiteSentences.length !== blackSentences.length
  ) {
    return null;
  }

  for (let i = 0; i < whiteSentences.length; i++) {
    if (whiteSentences[i] !== blackSentences[i]) return null;
  }

  const whiteSequence = orderedTraceSequence(whiteTrace);
  const blackSequence = orderedTraceSequence(blackTrace);
  if (!whiteSequence || !blackSequence) return null;
  if (
    whiteSequence.length !== whiteSentences.length ||
    blackSequence.length !== blackSentences.length
  ) {
    return null;
  }

  const agreementKappa = computeCohenKappa(whiteSequence, blackSequence);
  if (!Number.isFinite(agreementKappa)) return null;

  return {
    model,
    dataset,
    pmcid: whitePmcid,
    questionId:
      whiteTrace.question_id === undefined
        ? normalizeQuestionId(blackTrace.question_id)
        : normalizeQuestionId(whiteTrace.question_id),
    prompt:
      normalizeText(whiteTrace.case_prompt) || normalizeText(blackTrace.case_prompt),
    sentenceCount: whiteSentences.length,
    agreementKappa,
  };
}

function comparePoolEntries(
  a: Pick<PoolSelectionEntry, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  b: Pick<PoolSelectionEntry, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  datasetOrder: readonly string[]
): number {
  const kappaA = a.agreementKappa ?? Number.NEGATIVE_INFINITY;
  const kappaB = b.agreementKappa ?? Number.NEGATIVE_INFINITY;
  if (kappaB !== kappaA) {
    return kappaB - kappaA;
  }

  if (b.sentenceCount !== a.sentenceCount) {
    return b.sentenceCount - a.sentenceCount;
  }

  if (a.model !== b.model) {
    return a.model.localeCompare(b.model);
  }

  const datasetRank = new Map(datasetOrder.map((dataset, index) => [dataset, index]));
  const rankA = datasetRank.get(a.dataset) ?? Number.MAX_SAFE_INTEGER;
  const rankB = datasetRank.get(b.dataset) ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  if (a.dataset !== b.dataset) {
    return a.dataset.localeCompare(b.dataset);
  }

  return a.pmcid.localeCompare(b.pmcid);
}

function compareCandidates(
  a: Pick<RankedCaseCandidate, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  b: Pick<RankedCaseCandidate, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  datasetOrder: readonly string[]
): number {
  return comparePoolEntries(a, b, datasetOrder);
}

export function sortAndSelectTestCases<T extends RankedCaseCandidate>(
  candidates: readonly T[],
  maxCases: number,
  datasetOrder: readonly string[]
): T[] {
  const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, datasetOrder));
  const selected: T[] = [];
  const seenPmcids = new Set<string>();

  for (const candidate of sorted) {
    if (seenPmcids.has(candidate.pmcid)) continue;
    seenPmcids.add(candidate.pmcid);
    selected.push(candidate);
    if (selected.length >= maxCases) break;
  }

  return selected;
}

export function sortPoolEntriesByAgreement<T extends PoolSelectionEntry>(
  entries: readonly T[],
  datasetOrder: readonly string[]
): T[] {
  return [...entries].sort((a, b) => comparePoolEntries(a, b, datasetOrder));
}

export function selectCasesByCellTargets<T extends RankedCaseCandidate>(
  candidates: readonly T[],
  cellTargets: readonly CellTarget[],
  datasetOrder: readonly string[]
): T[] {
  const byCell = new Map<string, T[]>();

  for (const candidate of candidates) {
    const key = `${candidate.model}__${candidate.dataset}`;
    const current = byCell.get(key);
    if (current) current.push(candidate);
    else byCell.set(key, [candidate]);
  }

  for (const items of byCell.values()) {
    items.sort((a, b) => compareCandidates(a, b, datasetOrder));
  }

  const selected: T[] = [];
  const seenPmcids = new Set<string>();

  for (const target of cellTargets) {
    const key = `${target.model}__${target.dataset}`;
    const items = byCell.get(key) ?? [];
    let taken = 0;

    for (const candidate of items) {
      if (seenPmcids.has(candidate.pmcid)) continue;
      seenPmcids.add(candidate.pmcid);
      selected.push(candidate);
      taken++;
      if (taken >= target.count) break;
    }

    if (taken < target.count) {
      throw new Error(
        `Unable to fill quota for ${target.model} ${target.dataset}: expected ${target.count}, got ${taken}`
      );
    }
  }

  return selected;
}

function takeNextUniqueCase<T extends PoolSelectionEntry>(
  items: readonly T[],
  seenPmcids: Set<string>
): T | null {
  for (const item of items) {
    if (!seenPmcids.has(item.pmcid)) {
      return item;
    }
  }
  return null;
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function getDeficit(
  targets: Readonly<Record<string, number>> | undefined,
  counts: Map<string, number>,
  key: string
): number {
  if (!targets) return 0;
  return (targets[key] ?? 0) - (counts.get(key) ?? 0);
}

function candidateFillScore(
  candidate: PoolSelectionEntry,
  modelCounts: Map<string, number>,
  datasetCounts: Map<string, number>,
  modelTargets: Readonly<Record<string, number>> | undefined,
  datasetTargets: Readonly<Record<string, number>> | undefined
): number {
  const modelDeficit = getDeficit(modelTargets, modelCounts, candidate.model);
  const datasetDeficit = getDeficit(datasetTargets, datasetCounts, candidate.dataset);
  const helpsModel = modelDeficit > 0;
  const helpsDataset = datasetDeficit > 0;

  let score = 0;
  if (helpsModel && helpsDataset) score += 1_000_000_000;
  else if (helpsModel || helpsDataset) score += 1_000_000;

  score += Math.max(modelDeficit, 0) * 10_000;
  score += Math.max(datasetDeficit, 0) * 10_000;

  if (modelDeficit < 0) score += modelDeficit * 100_000;
  if (datasetDeficit < 0) score += datasetDeficit * 100_000;

  if (candidate.agreementKappa !== null) {
    score += 10_000;
    score += candidate.agreementKappa * 1_000;
  }

  score += candidate.sentenceCount / 1_000;
  return score;
}

function assertTargetsSatisfied(
  targets: Readonly<Record<string, number>> | undefined,
  counts: Map<string, number>,
  label: string
) {
  if (!targets) return;

  for (const [key, target] of Object.entries(targets)) {
    const actual = counts.get(key) ?? 0;
    if (actual < target) {
      throw new Error(
        `Unable to satisfy ${label} target for ${key}: expected at least ${target}, got ${actual}`
      );
    }
  }
}

export function selectCasesWithCoverage({
  fixedCases,
  scoredCandidates,
  fallbackCandidates,
  requiredCells,
  maxCases,
  datasetOrder,
  modelTargets,
  datasetTargets,
}: SelectCasesWithCoverageArgs): PoolSelectionEntry[] {
  if (fixedCases.length > maxCases) {
    throw new Error(
      `Fixed cases exceed pool size: ${fixedCases.length} > ${maxCases}`
    );
  }

  const sortedScored = [...scoredCandidates].sort((a, b) =>
    compareCandidates(a, b, datasetOrder)
  );
  const scoredByCell = new Map<string, RankedCaseCandidate[]>();
  const fallbackByCell = new Map<string, PoolSelectionEntry[]>();

  for (const candidate of sortedScored) {
    const key = poolCellKey(candidate);
    const items = scoredByCell.get(key);
    if (items) items.push(candidate);
    else scoredByCell.set(key, [candidate]);
  }

  for (const candidate of fallbackCandidates) {
    const key = poolCellKey(candidate);
    const items = fallbackByCell.get(key);
    if (items) items.push(candidate);
    else fallbackByCell.set(key, [candidate]);
  }

  const selected: PoolSelectionEntry[] = [];
  const seenPmcids = new Set<string>();
  const coveredCells = new Set<string>();
  const modelCounts = new Map<string, number>();
  const datasetCounts = new Map<string, number>();
  const allCellKeys = new Set<string>([
    ...requiredCells.map((cell) => poolCellKey(cell)),
    ...scoredByCell.keys(),
    ...fallbackByCell.keys(),
  ]);

  const addSelected = (item: PoolSelectionEntry) => {
    selected.push(item);
    seenPmcids.add(item.pmcid);
    coveredCells.add(poolCellKey(item));
    incrementCount(modelCounts, item.model);
    incrementCount(datasetCounts, item.dataset);
  };

  for (const fixedCase of fixedCases) {
    if (seenPmcids.has(fixedCase.pmcid)) {
      throw new Error(`Duplicate fixed case pmcid: ${fixedCase.pmcid}`);
    }
    addSelected(fixedCase);
  }

  for (const cell of requiredCells) {
    const key = poolCellKey(cell);
    if (coveredCells.has(key)) continue;

    const chosen =
      takeNextUniqueCase(scoredByCell.get(key) ?? [], seenPmcids) ??
      takeNextUniqueCase(fallbackByCell.get(key) ?? [], seenPmcids);

    if (!chosen) {
      throw new Error(`Unable to cover required cell ${cell.model} ${cell.dataset}`);
    }

    addSelected(chosen);
  }

  while (selected.length < maxCases) {
    let bestCandidate: PoolSelectionEntry | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const cellKey of allCellKeys) {
      const candidate =
        takeNextUniqueCase(scoredByCell.get(cellKey) ?? [], seenPmcids) ??
        takeNextUniqueCase(fallbackByCell.get(cellKey) ?? [], seenPmcids);

      if (!candidate) continue;

      const score = candidateFillScore(
        candidate,
        modelCounts,
        datasetCounts,
        modelTargets,
        datasetTargets
      );

      if (
        score > bestScore ||
        (score === bestScore &&
          bestCandidate &&
          comparePoolEntries(candidate, bestCandidate, datasetOrder) < 0) ||
        (score === bestScore && !bestCandidate)
      ) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    if (!bestCandidate) break;
    addSelected(bestCandidate);
  }

  if (selected.length < maxCases) {
    throw new Error(
      `Unable to fill pool to ${maxCases} unique cases; got ${selected.length}`
    );
  }

  assertTargetsSatisfied(modelTargets, modelCounts, "model");
  assertTargetsSatisfied(datasetTargets, datasetCounts, "dataset");

  return selected.slice(0, maxCases);
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poolCellKey(item: { model: string; dataset: string }): string {
  return `${item.model}__${item.dataset}`;
}

function unavoidableAdjacentRepeatCount(counts: Iterable<number>): number {
  let total = 0;
  let maxCount = 0;

  for (const count of counts) {
    total += count;
    if (count > maxCount) maxCount = count;
  }

  const others = total - maxCount;
  return Math.max(0, maxCount - (others + 1));
}

function canPlaceAt<T extends { model: string; dataset: string }>(
  items: readonly T[],
  index: number,
  candidate: T
): boolean {
  const prev = index > 0 ? items[index - 1] : null;
  const next = index + 1 < items.length ? items[index + 1] : null;

  if (prev && prev.model === candidate.model && prev.dataset === candidate.dataset) {
    return false;
  }
  if (next && next.model === candidate.model && next.dataset === candidate.dataset) {
    return false;
  }
  return true;
}

function reduceAvoidableAdjacentRepeats<T extends { model: string; dataset: string }>(
  items: readonly T[]
): T[] {
  const reordered = [...items];

  for (let i = 1; i < reordered.length; i++) {
    const current = reordered[i];
    const prev = reordered[i - 1];
    if (current.model !== prev.model || current.dataset !== prev.dataset) continue;

    for (let j = 0; j < reordered.length; j++) {
      if (j === i || j === i - 1) continue;

      const swapCandidate = reordered[j];
      const original = reordered[i];
      reordered[i] = swapCandidate;
      reordered[j] = original;

      if (
        canPlaceAt(reordered, i, reordered[i]) &&
        canPlaceAt(reordered, j, reordered[j])
      ) {
        break;
      }

      reordered[j] = swapCandidate;
      reordered[i] = original;
    }
  }

  return reordered;
}

export function shuffleSelectedCasesDeterministically<T extends { model: string; dataset: string }>(
  items: readonly T[],
  seed: number
): T[] {
  const rankFrontier = 32;
  const recentDatasetWindow = 4;
  const recentModelWindow = 6;
  const rng = mulberry32(seed);
  const queuesByCell = new Map<string, { item: T; rank: number }[]>();
  const tieBreakers = new Map<string, number>();

  items.forEach((item, rank) => {
    const key = poolCellKey(item);
    const queue = queuesByCell.get(key);
    if (queue) queue.push({ item, rank });
    else queuesByCell.set(key, [{ item, rank }]);

    if (!tieBreakers.has(key)) {
      tieBreakers.set(key, rng());
    }
  });

  const ordered: T[] = [];
  let previousCell: string | null = null;

  while (ordered.length < items.length) {
    const availableCells = [...queuesByCell.entries()]
      .filter(([, queue]) => queue.length > 0)
      .map(([key]) => key);

    if (availableCells.length === 0) break;

    const candidateCells = availableCells.some((key) => key !== previousCell)
      ? availableCells.filter((key) => key !== previousCell)
      : availableCells;

    const nextRankForCell = (cell: string) =>
      queuesByCell.get(cell)?.[0]?.rank ?? Number.MAX_SAFE_INTEGER;
    const minRank = candidateCells.reduce(
      (best, cell) => Math.min(best, nextRankForCell(cell)),
      Number.MAX_SAFE_INTEGER
    );
    let frontierCells = candidateCells.filter(
      (cell) => nextRankForCell(cell) <= minRank + rankFrontier
    );

    const recentDatasets = new Set(
      ordered
        .slice(-recentDatasetWindow)
        .map((item) => item.dataset)
    );
    const datasetNovelCells = frontierCells.filter((cell) => {
      const dataset = queuesByCell.get(cell)?.[0]?.item.dataset;
      return dataset ? !recentDatasets.has(dataset) : false;
    });
    if (datasetNovelCells.length > 0) {
      frontierCells = datasetNovelCells;
    }

    const recentModels = new Set(
      ordered
        .slice(-recentModelWindow)
        .map((item) => item.model)
    );
    const modelNovelCells = frontierCells.filter((cell) => {
      const model = queuesByCell.get(cell)?.[0]?.item.model;
      return model ? !recentModels.has(model) : false;
    });
    if (modelNovelCells.length > 0) {
      frontierCells = modelNovelCells;
    }

    frontierCells.sort((cellA, cellB) => {
      const remainingA = new Map(
        [...queuesByCell.entries()].map(([key, queue]) => [
          key,
          queue.length - (key === cellA ? 1 : 0),
        ])
      );
      const remainingB = new Map(
        [...queuesByCell.entries()].map(([key, queue]) => [
          key,
          queue.length - (key === cellB ? 1 : 0),
        ])
      );

      const pressureA = unavoidableAdjacentRepeatCount(remainingA.values());
      const pressureB = unavoidableAdjacentRepeatCount(remainingB.values());
      if (pressureA !== pressureB) return pressureA - pressureB;

      const nextRankA = nextRankForCell(cellA);
      const nextRankB = nextRankForCell(cellB);
      if (nextRankA !== nextRankB) return nextRankA - nextRankB;

      const remainingCountA = queuesByCell.get(cellA)?.length ?? 0;
      const remainingCountB = queuesByCell.get(cellB)?.length ?? 0;
      if (remainingCountA !== remainingCountB) return remainingCountB - remainingCountA;

      return (tieBreakers.get(cellA) ?? 0) - (tieBreakers.get(cellB) ?? 0);
    });

    const chosenCell = frontierCells[0];
    const chosenQueue = queuesByCell.get(chosenCell);
    if (!chosenQueue || chosenQueue.length === 0) break;
    const next = chosenQueue.shift();
    if (!next) break;

    ordered.push(next.item);
    previousCell = chosenCell;
  }

  return reduceAvoidableAdjacentRepeats(ordered);
}

export function buildIndexedLabelerPool(manifest: LabelerPoolManifest): IndexedPoolItem[] {
  return [...manifest.training, ...manifest.test].map((item, index) => ({
    ...item,
    index,
  }));
}

function poolKey(model: string, dataset: string): string {
  return `${model}_${dataset}`;
}

export function buildCaseIndexLookup(
  pool: readonly Pick<IndexedPoolItem, "model" | "dataset" | "caseIndex">[]
): Map<string, Set<number>> {
  const lookup = new Map<string, Set<number>>();

  for (const item of pool) {
    const key = poolKey(item.model, item.dataset);
    const indices = lookup.get(key) ?? new Set<number>();
    indices.add(item.caseIndex);
    lookup.set(key, indices);
  }

  return lookup;
}

export function filterCasesMapToPool<T>(
  casesMap: Record<string, T[]>,
  caseIndexLookup: ReadonlyMap<string, ReadonlySet<number>>
): Record<string, T[]> {
  const filtered: Record<string, T[]> = {};

  for (const [key, cases] of Object.entries(casesMap)) {
    const allowedIndices = caseIndexLookup.get(key);
    if (!allowedIndices) continue;

    const allowedCases = cases.filter((_, index) => allowedIndices.has(index));
    if (allowedCases.length > 0) {
      filtered[key] = allowedCases;
    }
  }

  return filtered;
}
