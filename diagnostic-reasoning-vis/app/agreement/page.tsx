"use client";

import { useMemo, useEffect, useState } from "react";
import { useMetadata } from "@/hooks/useMetadata";
import { useCases } from "@/hooks/useCases";
import { useAppState } from "@/hooks/useAppState";
import { useLabelingState } from "@/hooks/useLabelingState";
import { fetchAllRatings } from "@/hooks/useRatingsSync";
import { AgreementDashboard } from "@/components/agreement/AgreementDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingsStore, ServerRatingsResponse } from "@/lib/labeling-types";
import { importRatings } from "@/lib/labeling-storage";

export default function AgreementPage() {
  const { metadata, isLoading: metaLoading } = useMetadata();
  const { selectedModel, selectedDataset } = useAppState();
  const { cases } = useCases(selectedModel, selectedDataset);
  const { ratings: localRatings, importRatings: storeImport } = useLabelingState();

  const [serverData, setServerData] = useState<ServerRatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    const raterMap: Record<string, string> = {}; // id -> name

    // Discover raters from local data
    for (const raterId of Object.keys(localRatings)) {
      if (!raterMap[raterId]) {
        raterMap[raterId] = raterId.slice(0, 8); // fallback name
      }
    }

    // Merge server data
    if (serverData) {
      for (const [raterId, { name, ratings: serverRatings }] of Object.entries(serverData)) {
        raterMap[raterId] = name;
        if (serverRatings) {
          // Server data fills in what's missing from local
          const partial: RatingsStore = { [raterId]: serverRatings };
          merged = importRatings(merged, partial);
        }
      }
    }

    const ratersList = Object.entries(raterMap).map(([id, name]) => ({ id, name }));
    return { mergedRatings: merged, raters: ratersList };
  }, [localRatings, serverData]);

  const casesMap = useMemo(() => {
    if (!cases) return {};
    return { [`${selectedModel}_${selectedDataset}`]: cases };
  }, [cases, selectedModel, selectedDataset]);

  const handleImport = (imported: RatingsStore) => {
    storeImport(imported);
  };

  if (metaLoading || !metadata || loading) {
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
        cases={cases}
        casesMap={casesMap}
        metadata={metadata}
        model={selectedModel}
        dataset={selectedDataset}
        onImport={handleImport}
      />
    </div>
  );
}
