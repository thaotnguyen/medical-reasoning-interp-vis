"use client";

import type { TaxonomyItem } from "@/lib/types";

interface CategoryMetric {
  category: number;
  agreement: number;
  precision: number;
  recall: number;
  f1: number;
}

interface CategoryAgreementTableProps {
  metrics: CategoryMetric[];
  taxonomy: TaxonomyItem[];
}

function fmt(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export function CategoryAgreementTable({
  metrics,
  taxonomy,
}: CategoryAgreementTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 font-medium">Category</th>
            <th className="text-right p-2 font-medium">Precision</th>
            <th className="text-right p-2 font-medium">Recall</th>
            <th className="text-right p-2 font-medium">F1</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.category} className="border-b border-border/50">
              <td className="p-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: taxonomy[m.category]?.color }}
                  />
                  {taxonomy[m.category]?.short_name ?? m.category}
                </span>
              </td>
              <td className="text-right p-2 tabular-nums">{fmt(m.precision)}</td>
              <td className="text-right p-2 tabular-nums">{fmt(m.recall)}</td>
              <td className="text-right p-2 tabular-nums font-medium">{fmt(m.f1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
