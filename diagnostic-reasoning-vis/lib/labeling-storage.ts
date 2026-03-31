// ============================================================
// localStorage persistence for human ratings
// ============================================================

import type { RatingsStore } from "./labeling-types";
import type { Case, Metadata } from "./types";
import { mapTaxonomy } from "./taxonomy-map";

const STORAGE_KEY = "drv-ratings";

/**
 * Remap old 7-category taxonomy indices to new 6-category scheme.
 * Safe to apply idempotently: values already in 0-5 range that don't need
 * remapping (0,1) pass through unchanged; only old indices 2-6 get remapped.
 * Old->New: 0->0, 1->1, 2->1, 3->4, 4->2, 5->3, 6->5
 */
const TAXONOMY_REMAP: Record<number, number> = { 2: 1, 3: 4, 4: 2, 5: 3, 6: 5 };
const MIGRATION_KEY = "drv-ratings-migrated-v2";

function migrateRatingsStore(store: RatingsStore): RatingsStore {
  function walk(obj: unknown): void {
    if (
      obj &&
      typeof obj === "object" &&
      "taxonomy" in obj &&
      "timestamp" in obj
    ) {
      const r = obj as { taxonomy: number; timestamp: number };
      if (r.taxonomy in TAXONOMY_REMAP) {
        r.taxonomy = TAXONOMY_REMAP[r.taxonomy];
      }
      return;
    }
    if (obj && typeof obj === "object") {
      for (const v of Object.values(obj)) walk(v);
    }
  }
  walk(store);
  return store;
}

export function loadRatings(): RatingsStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const store: RatingsStore = JSON.parse(raw);
    // Migrate once from 7-category to 6-category
    if (!localStorage.getItem(MIGRATION_KEY)) {
      migrateRatingsStore(store);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      localStorage.setItem(MIGRATION_KEY, "1");
    }
    return store;
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

  // Discover all rater IDs from the ratings store
  const raterIds = Object.keys(ratings).sort();
  const headerRaterCols = raterIds.map((id) => `"${id}"`).join(",");

  const rows: string[] = [
    `model,dataset,case_id,case_index,sentence_index,sentence_text,whitebox_label,${headerRaterCols}`,
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
          const mappedT = mapTaxonomy(sent.t);
          const wb = mappedT >= 0 ? taxonomyNames[mappedT] ?? String(mappedT) : "";

          const raterCols = raterIds
            .map((rid) => getRaterLabel(ratings, rid, modelSlug, datasetSlug, c.id, si, taxonomyNames))
            .join(",");

          rows.push(
            [
              modelSlug,
              datasetSlug,
              c.id,
              ci,
              si,
              `"${sent.s.replace(/"/g, '""').replace(/\n/g, " ")}"`,
              wb,
              raterCols,
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
  const mapped = mapTaxonomy(r.taxonomy);
  return taxonomyNames[mapped] ?? String(mapped);
}

export { migrateRatingsStore };

export function importRatings(existing: RatingsStore, imported: RatingsStore): RatingsStore {
  // Ensure imported data uses the new 6-category scheme
  migrateRatingsStore(imported);
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
