"use client";

/**
 * Complete transition matrix — every cell is shown, including values below the 0.1 the
 * chord and Sankey threshold at.
 *
 * scheme "blues" — Plotly's Blues: rare transitions read white/grey, common ones deep blue.
 * scheme "diff"  — signed (correct − incorrect): red for transitions the model makes more
 *                  often when it gets the case wrong, green for more often when right,
 *                  white at zero. Symmetric about 0 so the two sides stay comparable.
 */
export type MatrixScheme = "blues" | "diff";

// Plotly's Blues colorscale stops, interpolated in RGB.
const BLUES: [number, number, number][] = [
  [247, 251, 255], [222, 235, 247], [198, 219, 239], [158, 202, 225],
  [107, 174, 214], [66, 146, 198], [33, 113, 181], [8, 81, 156], [8, 48, 107],
];

function lerp(stops: [number, number, number][], t: number) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function TransitionMatrix({
  matrix,
  states,
  colors,
  scheme = "blues",
  scale,
  compact = false,
  center = false,
}: {
  matrix: number[][];
  states: string[];
  colors: string[];
  scheme?: MatrixScheme;
  /** Max absolute value for the diff scheme; defaults to the matrix's own max. */
  scale?: number;
  compact?: boolean;
  /** Centre the table in its container (used by the pooled "All models" blocks). */
  center?: boolean;
}) {
  const maxAbs =
    scale ??
    (scheme === "diff"
      ? Math.max(0.01, ...matrix.flat().map((v) => Math.abs(v)))
      : 1);

  const bg = (v: number) => {
    if (scheme === "blues") return lerp(BLUES, v);
    const t = Math.min(1, Math.abs(v) / maxAbs);
    // red (more common when wrong) .. white .. green (more common when right)
    const [r, g, b] = v >= 0 ? [22, 163, 74] : [220, 38, 38];
    return `rgba(${r},${g},${b},${t})`;
  };
  const fg = (v: number) => {
    if (scheme === "blues") return v > 0.55 ? "#fff" : "#1f2937";
    return Math.abs(v) / maxAbs > 0.6 ? "#fff" : "#1f2937";
  };
  const fmt = (v: number) =>
    scheme === "diff"
      ? (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2).slice(1)
      : v.toFixed(2);

  const label = (s: string) => (compact ? s.split(" ")[0] : s);
  const th = compact ? "text-[8px]" : "text-[10px]";
  const td = compact ? "w-7 h-6 text-[8px]" : "w-14 h-10 text-[11px]";

  return (
    <div className="overflow-x-auto">
      <table className={`border-separate border-spacing-0.5${center ? " mx-auto" : ""}`}>
        <thead>
          <tr>
            <th className="w-px" />
            {states.map((s, j) => (
              <th key={j} className={`${th} font-medium text-muted-foreground px-1 align-bottom`} title={s}>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors[j] }} />
                  {label(s)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className={`${th} font-medium text-muted-foreground pr-1 text-right whitespace-nowrap`} title={states[i]}>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} />
                  {label(states[i])}
                </span>
              </th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`${td} text-center rounded-[3px] tabular-nums`}
                  style={{ backgroundColor: bg(v), color: fg(v) }}
                  title={`${states[i]} → ${states[j]}: ${scheme === "diff" ? (v >= 0 ? "+" : "") + v.toFixed(3) : v.toFixed(3)}`}
                >
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
