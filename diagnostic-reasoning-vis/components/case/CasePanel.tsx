"use client";

import { CaseSwitcher } from "./CaseSwitcher";
import type { Case } from "@/lib/types";

interface CasePanelProps {
  cases: Case[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Show only the clinical case: drop the instruction boilerplate that precedes it
 * ("CASE PRESENTATION" header) and the "OUTPUT TEMPLATE" format block that trails it.
 */
function caseText(prompt: string): string {
  let s = prompt;
  const start = s.indexOf("CASE PRESENTATION");
  if (start !== -1) {
    s = s.slice(start + "CASE PRESENTATION".length).replace(/^[-\s]+/, "");
  }
  const end = s.indexOf("OUTPUT TEMPLATE");
  if (end !== -1) {
    // also drop the divider dashes that precede the OUTPUT TEMPLATE header
    s = s.slice(0, end).replace(/[-\s]+$/, "");
  }
  return s;
}

export function CasePanel({ cases, selectedIndex, onSelect }: CasePanelProps) {
  const currentCase = cases[selectedIndex];
  if (!currentCase) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Case</span>
        <CaseSwitcher
          cases={cases}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {caseText(currentCase.prompt)}
        </p>
      </div>
    </div>
  );
}
