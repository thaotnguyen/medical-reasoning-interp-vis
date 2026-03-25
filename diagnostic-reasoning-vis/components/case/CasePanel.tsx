"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { CaseSwitcher } from "./CaseSwitcher";
import type { Case } from "@/lib/types";

interface CasePanelProps {
  cases: Case[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function CasePanel({ cases, selectedIndex, onSelect }: CasePanelProps) {
  const currentCase = cases[selectedIndex];
  if (!currentCase) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Case</span>
        <CaseSwitcher
          cases={cases}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {currentCase.prompt}
        </p>
      </ScrollArea>
    </div>
  );
}
