"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { interpretKappa } from "@/lib/agreement-stats";

interface KappaCardProps {
  title: string;
  kappa: number;
  n: number;
}

export function KappaCard({ title, kappa, n }: KappaCardProps) {
  const { label, color } = interpretKappa(kappa);
  const displayKappa = isNaN(kappa) ? "---" : kappa.toFixed(3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums">{displayKappa}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Based on {n} co-labeled sentence{n !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
