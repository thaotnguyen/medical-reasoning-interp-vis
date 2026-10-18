"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { usePipelineTaxonomy } from "@/hooks/usePipelineTaxonomy";
import { LABELER_PIPELINE } from "@/lib/constants";
import { useLabelingState } from "@/hooks/useLabelingState";
import { fetchAllRatings, fetchRound } from "@/hooks/useRatingsSync";
import { AgreementDashboard } from "@/components/agreement/AgreementDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingsStore, ServerRatingsResponse } from "@/lib/labeling-types";
import type { Case } from "@/lib/types";
import { importRatings } from "@/lib/labeling-storage";
import {
  poolEntriesToItems,
  type ActivePoolItem,
  type GeometricPoolEntry,
} from "@/lib/labeler-active-pool";

export default function AgreementPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  // Agreement is measured on the categories raters choose from in the labeler.
  const { taxonomy: labelerTaxonomy } = usePipelineTaxonomy(LABELER_PIPELINE);
  const { ratings: localRatings, importRatings: storeImport } = useLabelingState();

  const [serverData, setServerData] = useState<ServerRatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [casesMap, setCasesMap] = useState<Record<string, Case[]>>({});
  const [casesLoading, setCasesLoading] = useState(false);
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  const [labelerPool, setLabelerPool] = useState<ActivePoolItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/pipelines/${LABELER_PIPELINE}/labeler-pool.json`)
      .then((r) => (r.ok ? (r.json() as Promise<GeometricPoolEntry[]>) : []))
      .then((entries) => {
        if (cancelled) return;
        setLabelerPool(poolEntriesToItems(entries));
      })
      .catch(() => {
        if (cancelled) return;
        setLabelerPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch all ratings from server on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Adopt the live round first, so this browser's ratings from an earlier round are not shown.
    fetchRound().then((round) => {
      if (round) useLabelingState.getState().adoptRound(round);
      return fetchAllRatings();
    }).then((data) => {
      if (!cancelled) {
        setServerData(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Merge server ratings with local ratings
  const { mergedRatings, raters } = useMemo(() => {
    let merged: RatingsStore = { ...localRatings };
    const raterMap: Record<string, string> = {};

    for (const raterId of Object.keys(localRatings)) {
      if (!raterMap[raterId]) {
        raterMap[raterId] = raterId.slice(0, 8);
      }
    }

    if (serverData) {
      for (const [raterId, { name, ratings: serverRatings }] of Object.entries(serverData)) {
        raterMap[raterId] = name;
        if (serverRatings) {
          const partial: RatingsStore = { [raterId]: serverRatings };
          merged = importRatings(merged, partial);
        }
      }
    }

    const ratersList = Object.entries(raterMap).map(([id, name]) => ({ id, name }));
    return { mergedRatings: merged, raters: ratersList };
  }, [localRatings, serverData]);

  // Load case files for every model in the geometric labeler pool, plus any
  // model that already has ratings recorded (covers historical raters).
  const neededKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of labelerPool) {
      keys.add(`${item.model}_${item.dataset}`);
    }
    for (const raterId of Object.keys(mergedRatings)) {
      const models = mergedRatings[raterId];
      if (!models) continue;
      for (const model of Object.keys(models)) {
        for (const dataset of Object.keys(models[model])) {
          keys.add(`${model}_${dataset}`);
        }
      }
    }
    return Array.from(keys).sort();
  }, [mergedRatings, labelerPool]);

  useEffect(() => {
    if (neededKeys.length === 0) return;
    const missing = neededKeys.filter((k) => !fetchedKeysRef.current.has(k));
    if (missing.length === 0) return;
    for (const k of missing) fetchedKeysRef.current.add(k);

    setCasesLoading(true);
    Promise.all(
      missing.map(async (key) => {
        const idx = key.lastIndexOf("_");
        const model = idx >= 0 ? key.slice(0, idx) : key;
        try {
          const res = await fetch(
            `/data/pipelines/${LABELER_PIPELINE}/cases/${model}.json`
          );
          if (!res.ok) return { key, cases: null };
          const cases: Case[] = await res.json();
          return { key, cases };
        } catch {
          return { key, cases: null };
        }
      })
    ).then((results) => {
      setCasesMap((prev) => {
        const next = { ...prev };
        for (const { key, cases } of results) {
          if (cases) next[key] = cases;
        }
        return next;
      });
      setCasesLoading(false);
    });
  }, [neededKeys]);

  const handleImport = useCallback((imported: RatingsStore) => {
    storeImport(imported);
  }, [storeImport]);

  if (metaLoading || !metadata || !labelerTaxonomy.length || loading || casesLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <AgreementDashboard
        ratings={mergedRatings}
        raters={raters}
        casesMap={casesMap}
        labelerPool={labelerPool}
        metadata={{ ...metadata, taxonomy: labelerTaxonomy }}
        onImport={handleImport}
      />
    </div>
  );
}
