"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Case } from "@/lib/types";

interface CaseSwitcherProps {
  cases: Case[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function CaseSwitcher({ cases, selectedIndex, onSelect }: CaseSwitcherProps) {
  return (
    <Select
      value={String(selectedIndex)}
      onValueChange={(val) => onSelect(Number(val))}
    >
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Select a case" />
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto"
      >
        {cases.map((c, i) => (
          <SelectItem key={c.id} value={String(i)} className="text-xs">
            <span className="flex items-center gap-1 min-w-0 max-w-full">
              <span className="font-mono shrink-0">#{i + 1}</span>
              <span className="truncate">{c.true_dx || "—"}</span>
              <span className={`shrink-0 ${c.correct ? "text-green-600" : "text-red-500"}`}>
                {c.correct ? "✓" : "✗"}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
