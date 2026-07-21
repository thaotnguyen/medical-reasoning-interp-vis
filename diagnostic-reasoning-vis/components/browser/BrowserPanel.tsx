"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaxonomyCard } from "./TaxonomyCard";
import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import type { TaxonomyItem, TaxonomyExample } from "@/lib/types";

interface BrowserPanelProps {
  taxonomy: TaxonomyItem[];
}

export function BrowserPanel({ taxonomy }: BrowserPanelProps) {
  const [selected, setSelected] = useState(0);
  const current = taxonomy[selected];
  const router = useRouter();
  const { metadata } = useMetadata();
  const { setModel, setCaseIndex, setHoveredSentence } = useAppState();

  const modelName = (slug: string) =>
    metadata?.models[slug]?.display_name ?? slug;

  const DATASET_SHORT: Record<string, string> = {
    medqa: "MedQA",
    "medmcqa-filtered": "MedMCQA",
    "nejm-cpc": "NEJM",
  };
  const datasetName = (id?: string) => (id ? DATASET_SHORT[id] ?? id : "");

  const openInExplorer = (ex: TaxonomyExample) => {
    // setModel resets the case to 0 and clears hover, so order matters.
    setModel(ex.model);
    setCaseIndex(ex.caseIdx);
    setHoveredSentence(ex.sentIdx);
    router.push("/");
  };

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      {/* Left: the universal taxonomy categories */}
      <div className="w-full md:w-[360px] shrink-0 border-b md:border-b-0 md:border-r flex flex-col min-h-0 md:max-h-none">
        {/* Heading is desktop-only; on a phone it just eats vertical space. */}
        <div className="hidden md:block px-5 py-4 border-b shrink-0">
          <h2 className="text-sm font-semibold">Universal Taxonomy</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {taxonomy.length} reasoning categories
          </p>
        </div>

        {/* Phones: one horizontally-scrolling row. Cards are narrow enough to stay
            taller than they are wide, wide enough that the title does not truncate,
            and `items-stretch` makes them all match the tallest one. */}
        <div className="md:hidden overflow-x-auto overscroll-x-contain">
          <div className="flex items-stretch gap-2 p-3 w-max">
            {taxonomy.map((item, i) => (
              <TaxonomyCard
                key={i}
                item={item}
                selected={i === selected}
                onSelect={() => setSelected(i)}
                className="w-[172px] shrink-0"
              />
            ))}
          </div>
        </div>

        <ScrollArea className="hidden md:block flex-1 min-h-0">
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

      {/* Right: example sentences (click to open in the Explorer) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ScrollArea className="flex-1 min-h-0">
          <ul className="divide-y">
            {(current?.examples ?? []).map((ex, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => openInExplorer(ex)}
                  className="w-full text-left px-6 py-3 hover:bg-accent/50 transition-colors group"
                  title="Open this sentence in the Explorer"
                >
                  <p className="text-sm leading-relaxed text-foreground/90">{ex.s}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-foreground/70">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: current?.color }}
                    />
                    {modelName(ex.model)}
                    {ex.dataset ? ` · ${datasetName(ex.dataset)}` : ""}
                    {ex.dx ? ` · ${ex.dx}` : ""}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      → open in Explorer
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!current?.examples?.length && (
              <li className="px-6 py-4 text-sm text-muted-foreground">
                No example sentences available.
              </li>
            )}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
}
