"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { TaxonomyItem } from "@/lib/types";

interface TaxonomyCardProps {
  item: TaxonomyItem;
  index: number;
}

export function TaxonomyCard({ item, index }: TaxonomyCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className="w-4 h-4 rounded-full shrink-0 mt-0.5"
          style={{ backgroundColor: item.color }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{item.short_name}</span>
            <span className="text-xs text-muted-foreground">({index})</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
