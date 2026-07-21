"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CaseSwitcher } from "./CaseSwitcher";
import type { Case } from "@/lib/types";

interface CasePanelProps {
  cases: Case[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Controlled by the page so the panel's reserved height collapses with it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

export function CasePanel({
  cases,
  selectedIndex,
  onSelect,
  open: openProp,
  onOpenChange,
}: CasePanelProps) {
  const [openState, setOpenState] = useState(true);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) =>
    onOpenChange ? onOpenChange(next) : setOpenState(next);
  const currentCase = cases[selectedIndex];
  if (!currentCase) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="case-prompt"
          title={open ? "Collapse case" : "Expand case"}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          Case
        </button>
        <CaseSwitcher
          cases={cases}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      </div>
      {open && (
        <div
          id="case-prompt"
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
        >
          {/* text-xs to match the annotated sentences in the trace panel below */}
          <p className="text-xs leading-relaxed whitespace-pre-wrap">
            {caseText(currentCase.prompt)}
          </p>
        </div>
      )}
    </div>
  );
}
