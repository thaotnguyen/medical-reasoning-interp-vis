"use client";

interface TraceStatsProps {
  sentenceCount: number;
}

export function TraceStats({ sentenceCount }: TraceStatsProps) {
  return (
    <div className="px-4 py-1.5 text-xs text-muted-foreground border-b">
      {sentenceCount} sentences
    </div>
  );
}
