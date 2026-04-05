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

export interface LabelerPoolTestEntry {
  model: string;
  dataset: string;
  caseIndex: number;
  pmcid: string;
  sentenceCount: number;
  agreementKappa: number;
}

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
  agreementKappa?: number;
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

function compareCandidates(
  a: Pick<RankedCaseCandidate, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  b: Pick<RankedCaseCandidate, "model" | "dataset" | "pmcid" | "sentenceCount" | "agreementKappa">,
  datasetOrder: readonly string[]
): number {
  if (b.agreementKappa !== a.agreementKappa) {
    return b.agreementKappa - a.agreementKappa;
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

export function shuffleSelectedCasesDeterministically<T extends { model: string; dataset: string }>(
  items: readonly T[],
  seed: number
): T[] {
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

    candidateCells.sort((cellA, cellB) => {
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

      const nextRankA = queuesByCell.get(cellA)?.[0]?.rank ?? Number.MAX_SAFE_INTEGER;
      const nextRankB = queuesByCell.get(cellB)?.[0]?.rank ?? Number.MAX_SAFE_INTEGER;
      if (nextRankA !== nextRankB) return nextRankA - nextRankB;

      const remainingCountA = queuesByCell.get(cellA)?.length ?? 0;
      const remainingCountB = queuesByCell.get(cellB)?.length ?? 0;
      if (remainingCountA !== remainingCountB) return remainingCountB - remainingCountA;

      return (tieBreakers.get(cellA) ?? 0) - (tieBreakers.get(cellB) ?? 0);
    });

    const chosenCell = candidateCells[0];
    const chosenQueue = queuesByCell.get(chosenCell);
    if (!chosenQueue || chosenQueue.length === 0) break;
    const next = chosenQueue.shift();
    if (!next) break;

    ordered.push(next.item);
    previousCell = chosenCell;
  }

  return ordered;
}

export function buildIndexedLabelerPool(manifest: LabelerPoolManifest): IndexedPoolItem[] {
  return [...manifest.training, ...manifest.test].map((item, index) => ({
    ...item,
    index,
  }));
}
