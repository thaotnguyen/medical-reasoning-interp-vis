"use client";

import { useEffect, useRef } from "react";

export interface SankeyLink {
  s: number;
  t: number;
  v: number;
}

/**
 * Client-side Plotly Sankey. Rendered in the browser rather than pre-rendered to SVG so the
 * links highlight on hover and show a tooltip naming the transition — Plotly's Sankey does
 * both natively once the trace is live.
 *
 * plotly.js-dist-min is ~3.5 MB, so it is imported dynamically: only this route pays for it.
 */
export function SankeyPlot({
  links,
  states,
  colors,
  height = 420,
  compact = false,
}: {
  links: SankeyLink[];
  states: string[];
  colors: string[];
  height?: number;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let el: HTMLDivElement | null = null;

    (async () => {
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (disposed || !ref.current) return;
      el = ref.current;

      // Use whatever the page is actually rendering in (Geist, via next/font) so the
      // figures match the rest of the site rather than Plotly's default.
      const fontFamily = getComputedStyle(document.body).fontFamily;

      const K = states.length;

      // Left column stays in taxonomy order. The right is ordered by the barycentre
      // heuristic — each target sits at the weighted mean position of the sources feeding
      // it — which is the standard first pass for minimising edge crossings and is optimal
      // here because the left order is fixed. Targets with no inbound link keep their own
      // index as the tiebreak so their (empty) slot stays put.
      const bary = states.map((_, j) => {
        let num = 0, den = 0;
        for (const l of links) if (l.t === j) { num += l.v * l.s; den += l.v; }
        return den ? num / den : j;
      });
      const rightSlot: number[] = [];
      states
        .map((_, j) => j)
        .sort((a, b) => bary[a] - bary[b] || a - b)
        .forEach((j, slot) => { rightSlot[j] = slot; });
      const rgba = (hex: string, a: number) => {
        const h = hex.replace("#", "");
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
        return `rgba(${r},${g},${b},${a})`;
      };

      const data = [
        {
          type: "sankey" as const,
          // "fixed" so the explicit x/y are honoured. Plotly's own "snap" would reorder
          // both columns; we want the left pinned to taxonomy order and only the right free
          // to reduce crossings, which it cannot express — hence rightSlot below.
          arrangement: "fixed" as const,
          node: {
            label: [...states, ...states],
            color: [...colors, ...colors],
            x: [...states.map(() => 0.001), ...states.map(() => 0.999)],
            y: [
              ...states.map((_, i) => (i + 0.5) / K),
              ...states.map((_, i) => (rightSlot[i] + 0.5) / K),
            ],
            pad: compact ? 8 : 14,
            thickness: compact ? 9 : 12,
            line: { width: 0 },
            hovertemplate: "%{label}<extra></extra>",
          },
          link: {
            source: links.map((l) => l.s),
            target: links.map((l) => l.t + K),
            value: links.map((l) => l.v),
            // Base opacity is low; Plotly darkens the hovered link automatically.
            color: links.map((l) => rgba(colors[l.s], 0.4)),
            hovertemplate:
              "%{source.label} → %{target.label}<br>P = %{value:.2f}<extra></extra>",
          },
        },
      ];

      await Plotly.newPlot(
        el,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data as any,
        {
          font: { size: compact ? 8 : 11, family: fontFamily, color: "#334155" },
          margin: { l: 4, r: 4, t: 4, b: 4 },
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          height,
          hoverlabel: {
            bgcolor: "#111827",
            font: { color: "#fff", size: 11, family: fontFamily },
          },
        },
        { displayModeBar: false, responsive: true }
      );

      // Plotly has no bbox option for Sankey node labels, so the plate is added afterwards:
      // one rounded translucent rect per label, inserted just before its <text> so it
      // paints underneath. Re-applied on relayout, since Plotly rebuilds the label nodes.
      const plateLabels = () => {
        if (!el) return;
        el.querySelectorAll("g.sankey-node-plate").forEach((n) => n.remove());
        el.querySelectorAll<SVGTextElement>("g.sankey .node-label, g.sankey text.node-label")
          .forEach((text) => {
            const bb = text.getBBox();
            if (!bb.width) return;
            const ns = "http://www.w3.org/2000/svg";
            const g = document.createElementNS(ns, "g");
            g.setAttribute("class", "sankey-node-plate");
            const rect = document.createElementNS(ns, "rect");
            const padX = 3, padY = 1.5;
            rect.setAttribute("x", String(bb.x - padX));
            rect.setAttribute("y", String(bb.y - padY));
            rect.setAttribute("width", String(bb.width + padX * 2));
            rect.setAttribute("height", String(bb.height + padY * 2));
            rect.setAttribute("rx", "3");
            rect.setAttribute("fill", "#ffffff");
            rect.setAttribute("fill-opacity", "0.9");
            g.appendChild(rect);
            // Same transform as the label, so the plate tracks it exactly.
            const tr = text.getAttribute("transform");
            if (tr) g.setAttribute("transform", tr);
            text.parentNode?.insertBefore(g, text);
          });
      };
      plateLabels();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).on?.("plotly_afterplot", plateLabels);
    })();

    return () => {
      disposed = true;
      if (el) {
        import("plotly.js-dist-min").then(({ default: Plotly }) => Plotly.purge(el!));
      }
    };
  }, [links, states, colors, height, compact]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
