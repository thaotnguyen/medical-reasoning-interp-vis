"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaxonomyCard } from "./TaxonomyCard";
import { ClusterCard } from "./ClusterCard";
import type { TaxonomyItem, ClusterInfo } from "@/lib/types";

interface BrowserPanelProps {
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  modelDisplayName: string;
  numClusters: number;
}

export function BrowserPanel({
  taxonomy,
  clusters,
  modelDisplayName,
  numClusters,
}: BrowserPanelProps) {
  const clusterIds = Object.keys(clusters)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <Tabs defaultValue="taxonomy" className="flex flex-col h-full">
      <div className="px-6 pt-4 shrink-0">
        <TabsList>
          <TabsTrigger value="taxonomy" className="text-xs">
            Universal Taxonomy ({taxonomy.length})
          </TabsTrigger>
          <TabsTrigger value="clusters" className="text-xs">
            SAE Clusters — {modelDisplayName} ({numClusters})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="taxonomy" className="flex-1 overflow-hidden mt-0">
        <ScrollArea className="h-full">
          <div className="grid gap-3 p-6 max-w-3xl">
            {taxonomy.map((item, i) => (
              <TaxonomyCard key={i} item={item} index={i} />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="clusters" className="flex-1 overflow-hidden mt-0">
        <ScrollArea className="h-full">
          <div className="grid gap-3 p-6 max-w-3xl">
            {clusterIds.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cluster data available for {modelDisplayName}. Select a model
                with activations to view SAE clusters.
              </p>
            ) : (
              clusterIds.map((id, i) => (
                <ClusterCard
                  key={id}
                  clusterId={String(id)}
                  cluster={clusters[String(id)]}
                  colorIndex={i}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
