"use client";

import type { TaxonomyItem } from "@/lib/types";
import { TAXONOMY_REFERENCES } from "@/lib/taxonomy-reference";
import { X, CheckCircle2, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HelpDrawerProps {
  taxonomy: TaxonomyItem[];
  open: boolean;
  onClose: () => void;
}

export function HelpDrawer({ taxonomy, open, onClose }: HelpDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-lg bg-background shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h3 className="text-sm font-semibold">Category Reference</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {TAXONOMY_REFERENCES.map((ref, idx) => {
              const tax = taxonomy[idx];
              if (!tax) return null;

              return (
                <div key={idx} className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                      style={{ backgroundColor: tax.color }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold">{tax.short_name}</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ref.longDescription}
                  </p>

                  {/* Examples side by side */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-green-700 dark:text-green-400 mb-1">
                        <CheckCircle2 className="w-3 h-3" />
                        IS this category
                      </div>
                      <p className="text-[11px] italic leading-relaxed">
                        &ldquo;{ref.positiveExample}&rdquo;
                      </p>
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-2.5">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-red-700 dark:text-red-400 mb-1">
                        <XCircle className="w-3 h-3" />
                        NOT this category
                      </div>
                      <p className="text-[11px] italic leading-relaxed">
                        &ldquo;{ref.negativeExample}&rdquo;
                      </p>
                    </div>
                  </div>

                  {idx < TAXONOMY_REFERENCES.length - 1 && (
                    <div className="border-b pt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
