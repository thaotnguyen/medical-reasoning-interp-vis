"use client";

import { Card, CardContent } from "@/components/ui/card";
import { schemeTableau10 } from "d3-scale-chromatic";
import type { ClusterInfo } from "@/lib/types";

interface ClusterCardProps {
  clusterId: string;
  cluster: ClusterInfo;
  colorIndex: number;
}

export function ClusterCard({ clusterId, cluster, colorIndex }: ClusterCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className="w-4 h-4 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: schemeTableau10[colorIndex % 10] }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{cluster.title}</span>
            <span className="text-xs text-muted-foreground">
              (Cluster {clusterId})
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {cluster.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
