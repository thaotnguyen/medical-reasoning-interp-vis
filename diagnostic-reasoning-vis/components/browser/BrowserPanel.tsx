"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaxonomyCard } from "./TaxonomyCard";
import type { TaxonomyItem } from "@/lib/types";

interface BrowserPanelProps {
  taxonomy: TaxonomyItem[];
}

export function BrowserPanel({ taxonomy }: BrowserPanelProps) {
  const [selected, setSelected] = useState(0);
  const current = taxonomy[selected];

  return (
    <div className="flex h-full min-h-0">
      {/* Left: the universal taxonomy categories */}
      <div className="w-[360px] shrink-0 border-r flex flex-col min-h-0">
        <div className="px-5 py-4 border-b shrink-0">
          <h2 className="text-sm font-semibold">Universal Taxonomy</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {taxonomy.length} reasoning categories
          </p>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-2 p-4">
            {taxonomy.map((item, i) => (
              <TaxonomyCard
                key={i}
                item={item}
                selected={i === selected}
                onSelect={() => setSelected(i)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right: example sentences for the selected category */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {current && (
          <>
            <div className="px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: current.color }}
                />
                <h2 className="text-base font-semibold">{current.label}</h2>
              </div>
              {current.description && (
                <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl leading-relaxed">
                  {current.description}
                </p>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 py-5 max-w-3xl">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {current.examples?.length ?? 0} example sentences
                </p>
                <ul className="space-y-2">
                  {(current.examples ?? []).map((s, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed border-l-2 pl-3 py-0.5 text-foreground/90"
                      style={{ borderColor: current.color }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
                {!current.examples?.length && (
                  <p className="text-sm text-muted-foreground">
                    No example sentences available.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
