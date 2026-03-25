"use client";

export type ComparisonSource = string; // raterId or "whitebox"

interface RaterInfo {
  id: string;
  name: string;
}

interface AgreementScopeSelectorProps {
  raters: RaterInfo[];
  sourceA: ComparisonSource;
  sourceB: ComparisonSource;
  onSourceAChange: (s: ComparisonSource) => void;
  onSourceBChange: (s: ComparisonSource) => void;
}

export function AgreementScopeSelector({
  raters,
  sourceA,
  sourceB,
  onSourceAChange,
  onSourceBChange,
}: AgreementScopeSelectorProps) {
  const allSources = [
    { value: "whitebox", label: "Whitebox (automated)" },
    ...raters.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-muted-foreground font-medium">Compare:</span>
      <select
        className="h-8 border rounded-md px-2 bg-background text-xs"
        value={sourceA}
        onChange={(e) => onSourceAChange(e.target.value)}
      >
        {allSources.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">vs</span>
      <select
        className="h-8 border rounded-md px-2 bg-background text-xs"
        value={sourceB}
        onChange={(e) => onSourceBChange(e.target.value)}
      >
        {allSources.filter((s) => s.value !== sourceA).map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
