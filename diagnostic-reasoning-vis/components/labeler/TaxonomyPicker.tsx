"use client";

import type { TaxonomyItem } from "@/lib/types";
import { Check } from "lucide-react";

interface TaxonomyPickerProps {
  taxonomy: TaxonomyItem[];
  currentSelection: number | undefined; // taxonomy index or undefined
  onSelect: (taxonomyIndex: number) => void;
  onClear: () => void;
}

export function TaxonomyPicker({
  taxonomy,
  currentSelection,
  onSelect,
  onClear,
}: TaxonomyPickerProps) {
  return (
    <div className="flex flex-wrap gap-1 py-1.5 px-2 bg-muted/50 rounded-md">
      {taxonomy.map((t, idx) => {
        const isSelected = currentSelection === idx;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
              isSelected
                ? "ring-2 ring-offset-1 border-transparent"
                : "border-transparent hover:border-border"
            }`}
            style={{
              backgroundColor: isSelected ? t.color : `${t.color}20`,
              color: isSelected ? "white" : t.color,
              "--tw-ring-color": isSelected ? t.color : undefined,
            } as React.CSSProperties}
          >
            <span className="font-mono opacity-70">{idx + 1}</span>
            {t.short_name}
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        );
      })}
      {currentSelection !== undefined && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground hover:bg-muted border border-dashed border-border"
        >
          <span className="font-mono opacity-70 mr-0.5">0</span>
          Clear
        </button>
      )}
    </div>
  );
}
