"use client";

import { useState, useCallback } from "react";
import { zoomIdentity } from "d3-zoom";
import { scaleLinear } from "d3-scale";
import { TSNECanvas, type TSNEScales } from "./TSNECanvas";
import { TrajectoryOverlay } from "./TrajectoryOverlay";
import { TSNETooltip } from "./TSNETooltip";
import { TSNELegend } from "./TSNELegend";
import { Skeleton } from "@/components/ui/skeleton";
import type { TSNEPoint, TaxonomyItem, ClusterInfo, Case } from "@/lib/types";

interface TSNEPanelProps {
  points: TSNEPoint[] | null;
  isLoading: boolean;
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  cases: Case[] | undefined;
  colorMode: "taxonomy" | "cluster";
  onColorModeChange: (mode: "taxonomy" | "cluster") => void;
  activeCaseIdx: number | null;
  hoveredPointIdx: number | null;
  hoveredSentenceIdx: number | null;
  onHoverPoint: (index: number | null) => void;
  onClickPoint: (caseIdx: number, sentIdx: number) => void;
  trajectoryPlaying: boolean;
  onPlayTrajectory: () => void;
  onTrajectoryPlayComplete: () => void;
}

const defaultScales: TSNEScales = {
  scaleX: scaleLinear<number, number>(),
  scaleY: scaleLinear<number, number>(),
  transform: zoomIdentity,
};

export function TSNEPanel({
  points,
  isLoading,
  taxonomy,
  clusters,
  cases,
  colorMode,
  onColorModeChange,
  activeCaseIdx,
  hoveredPointIdx,
  hoveredSentenceIdx,
  onHoverPoint,
  onClickPoint,
  trajectoryPlaying,
  onPlayTrajectory,
  onTrajectoryPlayComplete,
}: TSNEPanelProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scales, setScales] = useState<TSNEScales>(defaultScales);

  const handleHoverPoint = useCallback(
    (index: number | null) => {
      onHoverPoint(index);
    },
    [onHoverPoint]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleScalesChange = useCallback((s: TSNEScales) => {
    setScales(s);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="flex-1 m-3 rounded-lg" />
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No activation data available for this model/dataset
      </div>
    );
  }

  const hoveredPoint =
    hoveredPointIdx !== null ? points[hoveredPointIdx] : null;

  const currentCase =
    activeCaseIdx !== null ? cases?.[activeCaseIdx] : undefined;

  return (
    <div className="flex flex-col h-full" onMouseMove={handleMouseMove}>
      {/* Canvas + trajectory overlay */}
      <div className="flex-1 relative overflow-hidden">
        <TSNECanvas
          points={points}
          taxonomy={taxonomy}
          clusters={clusters}
          colorMode={colorMode}
          activeCaseIdx={activeCaseIdx}
          hoveredIdx={hoveredPointIdx}
          hoveredSentenceIdx={hoveredSentenceIdx}
          onHoverPoint={handleHoverPoint}
          onClickPoint={onClickPoint}
          onScalesChange={handleScalesChange}
        />

        {/* Trajectory overlay */}
        {currentCase && (
          <TrajectoryOverlay
            sentences={currentCase.sentences}
            scaleX={scales.scaleX}
            scaleY={scales.scaleY}
            transform={scales.transform}
            hoveredSentenceIndex={hoveredSentenceIdx}
            isPlaying={trajectoryPlaying}
            onPlayComplete={onTrajectoryPlayComplete}
          />
        )}

        {/* Tooltip */}
        {hoveredPoint && (
          <TSNETooltip
            point={hoveredPoint}
            colorMode={colorMode}
            taxonomy={taxonomy}
            clusters={clusters}
            cases={cases}
            mouseX={mousePos.x}
            mouseY={mousePos.y}
          />
        )}
      </div>

      {/* Legend */}
      <div className="border-t shrink-0">
        <TSNELegend
          colorMode={colorMode}
          taxonomy={taxonomy}
          clusters={clusters}
        />
      </div>
    </div>
  );
}
