"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { schemeTableau10 } from "d3-scale-chromatic";
import { renderTSNE } from "@/lib/tsne-renderer";
import { findNearestPointLinear } from "@/lib/quadtree";
import type { TSNEPoint, TaxonomyItem, ClusterInfo } from "@/lib/types";

export interface TSNEScales {
  scaleX: ScaleLinear<number, number>;
  scaleY: ScaleLinear<number, number>;
  transform: ZoomTransform;
}

interface TSNECanvasProps {
  points: TSNEPoint[];
  taxonomy: TaxonomyItem[];
  clusters: Record<string, ClusterInfo>;
  colorMode: "taxonomy" | "cluster";
  activeCaseIdx: number | null;
  hoveredIdx: number | null;
  hoveredSentenceIdx: number | null;
  onHoverPoint: (index: number | null) => void;
  onClickPoint: (caseIdx: number, sentIdx: number) => void;
  onScalesChange?: (scales: TSNEScales) => void;
}

export function TSNECanvas({
  points,
  taxonomy,
  clusters,
  colorMode,
  activeCaseIdx,
  hoveredIdx,
  hoveredSentenceIdx,
  onHoverPoint,
  onClickPoint,
  onScalesChange,
}: TSNECanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ width: 0, height: 0 });

  const taxonomyColors = useMemo(
    () => taxonomy.map((t) => t.color),
    [taxonomy]
  );

  const clusterColorMap = useMemo(() => {
    const map = new Map<number, string>();
    const clusterIds = Object.keys(clusters)
      .map(Number)
      .sort((a, b) => a - b);
    clusterIds.forEach((id, i) => {
      map.set(id, schemeTableau10[i % 10]);
    });
    // Also handle -1
    map.set(-1, "#94a3b8");
    return map;
  }, [clusters]);

  // Compute scales from point extents
  const { scaleX, scaleY } = useMemo(() => {
    if (points.length === 0) {
      return {
        scaleX: scaleLinear().domain([0, 1]).range([0, 1]),
        scaleY: scaleLinear().domain([0, 1]).range([0, 1]),
      };
    }
    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const p of points) {
      if (p[0] < xMin) xMin = p[0];
      if (p[0] > xMax) xMax = p[0];
      if (p[1] < yMin) yMin = p[1];
      if (p[1] > yMax) yMax = p[1];
    }
    const pad = 0.05;
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const { width, height } = sizeRef.current;
    const margin = 20;

    return {
      scaleX: scaleLinear()
        .domain([xMin - xRange * pad, xMax + xRange * pad])
        .range([margin, (width || 600) - margin]),
      scaleY: scaleLinear()
        .domain([yMin - yRange * pad, yMax + yRange * pad])
        .range([margin, (height || 600) - margin]),
    };
  }, [points]);

  // Report initial scales to parent
  useEffect(() => {
    onScalesChange?.({ scaleX, scaleY, transform: transformRef.current });
  }, [scaleX, scaleY, onScalesChange]);

  // Render function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Determine effective hovered index:
    // If a sentence is hovered in the trace, find the corresponding point
    let effectiveHoveredIdx = hoveredIdx;
    if (hoveredSentenceIdx !== null && activeCaseIdx !== null) {
      for (let i = 0; i < points.length; i++) {
        if (
          points[i][4] === activeCaseIdx &&
          points[i][5] === hoveredSentenceIdx
        ) {
          effectiveHoveredIdx = i;
          break;
        }
      }
    }

    renderTSNE({
      ctx,
      width: sizeRef.current.width,
      height: sizeRef.current.height,
      points,
      scaleX,
      scaleY,
      colorMode,
      taxonomyColors,
      clusterColorMap,
      activeCaseIdx,
      hoveredIdx: effectiveHoveredIdx,
      transform: transformRef.current,
      dpr: window.devicePixelRatio || 1,
    });
  }, [
    points,
    scaleX,
    scaleY,
    colorMode,
    taxonomyColors,
    clusterColorMap,
    activeCaseIdx,
    hoveredIdx,
    hoveredSentenceIdx,
  ]);

  // Schedule draw with rAF
  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      sizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      scheduleDraw();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // Zoom behavior
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.5, 20])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        onScalesChange?.({ scaleX, scaleY, transform: event.transform });
        scheduleDraw();
      });

    select(canvas).call(zoomBehavior);

    return () => {
      select(canvas).on(".zoom", null);
    };
  }, [scheduleDraw]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const idx = findNearestPointLinear(
        points,
        mx,
        my,
        15,
        scaleX,
        scaleY,
        transformRef.current
      );
      onHoverPoint(idx);
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const idx = findNearestPointLinear(
        points,
        mx,
        my,
        15,
        scaleX,
        scaleY,
        transformRef.current
      );
      if (idx !== null) {
        const [, , , , caseIdx, sentIdx] = points[idx];
        onClickPoint(caseIdx, sentIdx);
      }
    };

    const handleMouseLeave = () => onHoverPoint(null);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [points, scaleX, scaleY, onHoverPoint, onClickPoint]);

  // Re-draw on prop changes
  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair" />
    </div>
  );
}
