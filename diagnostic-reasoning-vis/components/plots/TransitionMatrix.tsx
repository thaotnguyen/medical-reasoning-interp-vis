"use client";

/** Green -> red heatmap of P(next state | current state). */
export function TransitionMatrix({
  matrix,
  states,
  colors,
  minP,
  compact = false,
}: {
  matrix: number[][];
  states: string[];
  colors: string[];
  minP: number;
  compact?: boolean;
}) {
  // Green (low) -> yellow -> red (high), so a dominant transition reads hot.
  const cell = (v: number) => {
    if (v < minP) return "transparent";
    const t = Math.min(1, Math.max(0, (v - minP) / (1 - minP)));
    const hue = 130 - 130 * t; // 130deg green -> 0deg red
    return `hsl(${hue} 72% ${88 - 34 * t}%)`;
  };
  const fg = (v: number) => (v < minP ? "transparent" : v > 0.62 ? "#fff" : "#1f2937");

  const label = (s: string) => (compact ? s.split(" ")[0] : s);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="w-px" />
            {states.map((s, j) => (
              <th
                key={j}
                className={`${compact ? "text-[8px]" : "text-[10px]"} font-medium text-muted-foreground px-1 align-bottom`}
                title={s}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colors[j] }}
                  />
                  {label(s)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th
                className={`${compact ? "text-[8px]" : "text-[10px]"} font-medium text-muted-foreground pr-1 text-right whitespace-nowrap`}
                title={states[i]}
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colors[i] }}
                  />
                  {label(states[i])}
                </span>
              </th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`${compact ? "w-7 h-6 text-[8px]" : "w-14 h-10 text-[11px]"} text-center rounded-[3px] tabular-nums`}
                  style={{ backgroundColor: cell(v), color: fg(v) }}
                  title={`${states[i]} → ${states[j]}: ${v.toFixed(3)}`}
                >
                  {v >= minP ? v.toFixed(2) : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
