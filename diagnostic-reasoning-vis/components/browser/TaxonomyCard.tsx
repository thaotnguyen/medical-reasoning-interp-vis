"use client";

import type { TaxonomyItem } from "@/lib/types";

interface TaxonomyCardProps {
  item: TaxonomyItem;
  selected: boolean;
  onSelect: () => void;
  /** Extra sizing classes; the mobile strip uses this to fix the card width. */
  className?: string;
}

export function TaxonomyCard({
  item,
  selected,
  onSelect,
  className = "w-full",
}: TaxonomyCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${className} flex flex-col justify-start text-left rounded-lg border p-3 transition-colors ${
        selected ? "border-foreground/25 bg-accent" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start gap-2.5 w-full">
        <span
          className="w-3 h-3 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: item.color }}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug">{item.label}</div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
