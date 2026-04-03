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

export function renderTSNE(opts: RenderOptions) {
  const {
    ctx,
    width,
    height,
    points,
    scaleX,
    scaleY,
    colorMode,
    taxonomyColors,
    clusterColorMap,
    activeCaseIdx,
    hoveredIdx,
    transform,
    dpr,
  } = opts;

  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.k, transform.k);

  // Pass 1: background points
  for (let i = 0; i < points.length; i++) {
    const [x, y, tax, cluster, caseIdx] = points[i];
    if (caseIdx === activeCaseIdx || i === hoveredIdx) continue;

    const px = scaleX(x);
    const py = scaleY(y);
    const color =
      colorMode === "taxonomy"
        ? taxonomyColors[tax] ?? "#94a3b8"
        : clusterColorMap.get(cluster) ?? "#94a3b8";

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fill();
  }

  // Pass 2: active case points
  if (activeCaseIdx !== null) {
    for (let i = 0; i < points.length; i++) {
      const [x, y, tax, cluster, caseIdx] = points[i];
      if (caseIdx !== activeCaseIdx || i === hoveredIdx) continue;

      const px = scaleX(x);
      const py = scaleY(y);
      const color =
        colorMode === "taxonomy"
          ? taxonomyColors[tax] ?? "#94a3b8"
          : clusterColorMap.get(cluster) ?? "#94a3b8";

      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
  }

  // Pass 3: hovered point
  if (hoveredIdx !== null && hoveredIdx < points.length) {
    const [x, y, tax, cluster] = points[hoveredIdx];
    const px = scaleX(x);
    const py = scaleY(y);
    const color =
      colorMode === "taxonomy"
        ? taxonomyColors[tax] ?? "#94a3b8"
        : clusterColorMap.get(cluster) ?? "#94a3b8";

    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 1.0;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}
