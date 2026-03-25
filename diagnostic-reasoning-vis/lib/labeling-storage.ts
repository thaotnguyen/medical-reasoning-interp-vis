// ============================================================
// localStorage persistence for human ratings
// ============================================================

import type { RatingsStore } from "./labeling-types";
import type { Case, Metadata } from "./types";

const STORAGE_KEY = "drv-ratings";

export function loadRatings(): RatingsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRatings(ratings: RatingsStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
}

export function exportRatingsAsJSON(ratings: RatingsStore): string {
  return JSON.stringify(ratings, null, 2);
}

export function exportRatingsAsCSV(
  ratings: RatingsStore,
  casesMap: Record<string, Case[]>,
  metadata: Metadata
): string {
  const taxonomyNames = metadata.taxonomy.map((t) => t.short_name);
  const rows: string[] = [
    "model,dataset,case_id,case_index,sentence_index,sentence_text,whitebox_label,rater_1,rater_2,rater_3",
  ];

  for (const modelSlug of Object.keys(metadata.models)) {
    for (const datasetSlug of Object.keys(metadata.models[modelSlug].datasets)) {
      const key = `${modelSlug}_${datasetSlug}`;
      const cases = casesMap[key];
      if (!cases) continue;

      for (let ci = 0; ci < cases.length; ci++) {
        const c = cases[ci];
        for (let si = 0; si < c.sentences.length; si++) {
          const sent = c.sentences[si];
          const wb = sent.t >= 0 ? taxonomyNames[sent.t] ?? String(sent.t) : "";
          const r1 = getRaterLabel(ratings, "rater-1", modelSlug, datasetSlug, c.id, si, taxonomyNames);
          const r2 = getRaterLabel(ratings, "rater-2", modelSlug, datasetSlug, c.id, si, taxonomyNames);
          const r3 = getRaterLabel(ratings, "rater-3", modelSlug, datasetSlug, c.id, si, taxonomyNames);

          rows.push(
            [
              modelSlug,
              datasetSlug,
              c.id,
              ci,
              si,
              `"${sent.s.replace(/"/g, '""')}"`,
              wb,
              r1,
              r2,
              r3,
            ].join(",")
          );
        }
      }
    }
  }

  return rows.join("\n");
}

function getRaterLabel(
  ratings: RatingsStore,
  raterId: string,
  model: string,
  dataset: string,
  caseId: string,
  sentIdx: number,
  taxonomyNames: string[]
): string {
  const r = ratings[raterId]?.[model]?.[dataset]?.[caseId]?.[sentIdx];
  if (!r) return "";
  return taxonomyNames[r.taxonomy] ?? String(r.taxonomy);
}

export function importRatings(existing: RatingsStore, imported: RatingsStore): RatingsStore {
  const merged = JSON.parse(JSON.stringify(existing)) as RatingsStore;

  for (const [raterId, models] of Object.entries(imported)) {
    if (!merged[raterId]) merged[raterId] = {};
    for (const [model, datasets] of Object.entries(models)) {
      if (!merged[raterId][model]) merged[raterId][model] = {};
      for (const [dataset, cases] of Object.entries(datasets)) {
        if (!merged[raterId][model][dataset]) merged[raterId][model][dataset] = {};
        for (const [caseId, sentences] of Object.entries(cases)) {
          if (!merged[raterId][model][dataset][caseId])
            merged[raterId][model][dataset][caseId] = {};
          for (const [sentIdx, rating] of Object.entries(sentences)) {
            // Imported rating wins if newer
            const existing = merged[raterId][model][dataset][caseId][Number(sentIdx)];
            if (!existing || (rating as { timestamp: number }).timestamp > existing.timestamp) {
              merged[raterId][model][dataset][caseId][Number(sentIdx)] = rating as {
                taxonomy: number;
                timestamp: number;
              };
            }
          }
        }
      }
    }
  }

  return merged;
}
