"use client";

import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import { usePipelineTaxonomy } from "@/hooks/usePipelineTaxonomy";
import { BrowserPanel } from "@/components/browser/BrowserPanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function BrowserPage() {
  const { metadata, isLoading } = useMetadata();
  const { selectedModel, selectedPipeline } = useAppState();
  const { taxonomy } = usePipelineTaxonomy(selectedPipeline);

  if (isLoading || !metadata) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full mb-3" />
        <Skeleton className="h-24 w-full mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const modelInfo = metadata.models[selectedModel];

  return (
    <BrowserPanel
      taxonomy={taxonomy.length ? taxonomy : metadata.taxonomy}
      clusters={modelInfo?.clusters ?? {}}
      modelDisplayName={modelInfo?.display_name ?? selectedModel}
      numClusters={modelInfo?.num_clusters ?? 0}
    />
  );
}
