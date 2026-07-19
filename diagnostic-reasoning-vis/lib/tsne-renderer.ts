import type { TSNEPoint } from "./types";
import type { ScaleLinear } from "d3-scale";
import type { ZoomTransform } from "d3-zoom";

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  points: TSNEPoint[];
  scaleX: ScaleLinear<number, number>;
  scaleY: ScaleLinear<number, number>;
  colorMode: "taxonomy" | "cluster";
  taxonomyColors: string[];
  clusterColorMap: Map<number, string>;
  activeCaseIdx: number | null;
  hoveredIdx: number | null;
  transform: ZoomTransform;
  dpr: number;
}

function colorFor(
  tax: number,
  cluster: number,
  colorMode: "taxonomy" | "cluster",
  taxonomyColors: string[],
  clusterColorMap: Map<number, string>
): string {
  return colorMode === "taxonomy"
    ? taxonomyColors[tax] ?? "#94a3b8"
    : clusterColorMap.get(cluster) ?? "#94a3b8";
}

function applyTransform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  transform: ZoomTransform
) {
  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);
}

/**
 * Base layer: every point (background + active-case emphasis), independent of hover.
 * This is the expensive ~O(N) pass over all points, so it only needs to redraw when the
 * data / scales / colors / active case / zoom change — never on a mousemove.
 */
export function renderBase(opts: Omit<RenderOptions, "hoveredIdx">) {
  const { ctx, width, height, points, scaleX, scaleY, colorMode,
    taxonomyColors, clusterColorMap, activeCaseIdx, transform, dpr } = opts;

  applyTransform(ctx, width, height, dpr, transform);

  // Pass 1: background points
  for (let i = 0; i < points.length; i++) {
    const [x, y, tax, cluster, caseIdx] = points[i];
    if (caseIdx === activeCaseIdx) continue;
    ctx.beginPath();
    ctx.arc(scaleX(x), scaleY(y), 3, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
    ctx.globalAlpha = 0.1;
    ctx.fill();
  }

  // Pass 2: active case points
  if (activeCaseIdx !== null) {
    for (let i = 0; i < points.length; i++) {
      const [x, y, tax, cluster, caseIdx] = points[i];
      if (caseIdx !== activeCaseIdx) continue;
      ctx.beginPath();
      ctx.arc(scaleX(x), scaleY(y), 5, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Overlay layer: just the single hovered point highlight. Drawn on a separate canvas so a
 * mousemove clears/repaints one arc instead of all ~70k, which is what caused the flicker.
 */
export function renderHover(opts: Omit<RenderOptions, "activeCaseIdx">) {
  const { ctx, width, height, points, scaleX, scaleY, colorMode,
    taxonomyColors, clusterColorMap, hoveredIdx, transform, dpr } = opts;

  applyTransform(ctx, width, height, dpr, transform);

  if (hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length) {
    const [x, y, tax, cluster] = points[hoveredIdx];
    ctx.beginPath();
    ctx.arc(scaleX(x), scaleY(y), 7, 0, Math.PI * 2);
    ctx.fillStyle = colorFor(tax, cluster, colorMode, taxonomyColors, clusterColorMap);
    ctx.globalAlpha = 1.0;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

/** Single-pass renderer (kept for non-interactive/export callers). */
export function renderTSNE(opts: RenderOptions) {
  renderBase(opts);
  renderHover(opts);
}
