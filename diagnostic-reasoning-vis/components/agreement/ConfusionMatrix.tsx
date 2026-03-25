"use client";

import type { TaxonomyItem } from "@/lib/types";

interface ConfusionMatrixProps {
  matrix: number[][];
  taxonomy: TaxonomyItem[];
  sourceALabel: string;
  sourceBLabel: string;
}

export function ConfusionMatrix({
  matrix,
  taxonomy,
  sourceALabel,
  sourceBLabel,
}: ConfusionMatrixProps) {
  const maxVal = Math.max(1, ...matrix.flat());
  const numCats = taxonomy.length;

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-muted-foreground mb-2">
        Rows: {sourceALabel} | Columns: {sourceBLabel}
      </div>
      <table className="text-[11px] border-collapse">
        <thead>
          <tr>
            <th className="p-1.5" />
            {taxonomy.map((t, j) => (
              <th
                key={j}
                className="p-1.5 text-center font-medium max-w-16 truncate"
                title={t.short_name}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-0.5"
                  style={{ backgroundColor: t.color }}
                />
                {t.short_name.slice(0, 8)}
              </th>
            ))}
            <th className="p-1.5 text-center font-medium text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const rowSum = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={i}>
                <td className="p-1.5 font-medium whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: taxonomy[i]?.color }}
                  />
                  {taxonomy[i]?.short_name ?? i}
                </td>
                {row.map((val, j) => {
                  const isDiag = i === j;
                  const intensity = val / maxVal;
                  return (
                    <td
                      key={j}
                      className={`p-1.5 text-center tabular-nums ${
                        isDiag ? "font-bold" : ""
                      }`}
                      style={{
                        backgroundColor: isDiag
                          ? `rgba(34, 197, 94, ${intensity * 0.5})`
                          : val > 0
                            ? `rgba(239, 68, 68, ${intensity * 0.3})`
                            : undefined,
                      }}
                    >
                      {val || ""}
                    </td>
                  );
                })}
                <td className="p-1.5 text-center tabular-nums text-muted-foreground">
                  {rowSum}
                </td>
              </tr>
            );
          })}
          {/* Column totals */}
          <tr>
            <td className="p-1.5 font-medium text-muted-foreground">Total</td>
            {Array.from({ length: numCats }, (_, j) => {
              let colSum = 0;
              for (let i = 0; i < numCats; i++) colSum += matrix[i]?.[j] ?? 0;
              return (
                <td
                  key={j}
                  className="p-1.5 text-center tabular-nums text-muted-foreground"
                >
                  {colSum}
                </td>
              );
            })}
            <td className="p-1.5 text-center tabular-nums text-muted-foreground font-bold">
              {matrix.flat().reduce((a, b) => a + b, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
