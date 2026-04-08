"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import useSWRImmutable from "swr/immutable";
import { useMetadata } from "@/hooks/useMetadata";
import { useLabelingState } from "@/hooks/useLabelingState";
import { fetchAllRatings } from "@/hooks/useRatingsSync";
import { AgreementDashboard } from "@/components/agreement/AgreementDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingsStore, ServerRatingsResponse } from "@/lib/labeling-types";
import type { Case } from "@/lib/types";
import { importRatings } from "@/lib/labeling-storage";
import {
  buildIndexedLabelerPool,
  type LabelerPoolManifest,
} from "@/lib/labeler-pool";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AgreementPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  const { ratings: localRatings, importRatings: storeImport } = useLabelingState();
  const {
    data: labelerManifest,
    isLoading: labelerPoolLoading,
  } = useSWRImmutable<LabelerPoolManifest>("/data/labeler-pool.json", fetcher);

  const [serverData, setServerData] = useState<ServerRatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [casesMap, setCasesMap] = useState<Record<string, Case[]>>({});
  const [casesLoading, setCasesLoading] = useState(false);
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  const labelerPool = useMemo(
    () => (labelerManifest ? buildIndexedLabelerPool(labelerManifest) : []),
    [labelerManifest]
  );

  // Fetch all ratings from server on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllRatings().then((data) => {
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

  // Discover all model_dataset combos from merged ratings
  const neededKeys = useMemo(() => {
    const keys = new Set<string>();
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
  }, [mergedRatings]);

  // Load cases for all needed model_dataset combos
  // Use a ref to track fetched keys so we don't depend on casesMap in the effect
  useEffect(() => {
    if (neededKeys.length === 0) return;

    const missing = neededKeys.filter((k) => !fetchedKeysRef.current.has(k));
    if (missing.length === 0) return;

    // Mark as fetched immediately to prevent duplicate requests
    for (const k of missing) fetchedKeysRef.current.add(k);

    setCasesLoading(true);
    Promise.all(
      missing.map(async (key) => {
        try {
          const res = await fetch(`/data/cases/${key}.json`);
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

  if (metaLoading || !metadata || loading || casesLoading || labelerPoolLoading) {
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
        metadata={metadata}
        onImport={handleImport}
      />
    </div>
  );
}
