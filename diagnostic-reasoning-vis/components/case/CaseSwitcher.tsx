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
      <SelectContent className="max-h-64">
        {cases.map((c, i) => (
          <SelectItem key={c.id} value={String(i)} className="text-xs">
            <span className="font-mono mr-1">#{i + 1}</span>
            <span className="truncate">{c.true_dx}</span>
            {c.correct ? (
              <span className="ml-1 text-green-600">&#10003;</span>
            ) : (
              <span className="ml-1 text-red-500">&#10007;</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
