"use client";

import { Badge } from "@/components/ui/badge";

interface DiagnosisBarProps {
  predictedDx: string;
  trueDx: string;
  isCorrect: boolean;
}

export function DiagnosisBar({ predictedDx, trueDx, isCorrect }: DiagnosisBarProps) {
  return (
    <div className="flex flex-col gap-1.5 px-4 py-2 border-b text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 shrink-0">Predicted:</span>
        <span className="font-medium truncate">{predictedDx}</span>
        <Badge
          variant={isCorrect ? "default" : "destructive"}
          className="ml-auto shrink-0 text-[10px] h-5"
        >
          {isCorrect ? "Correct" : "Incorrect"}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 shrink-0">Gold Dx:</span>
        <span className="font-medium truncate">{trueDx}</span>
      </div>
    </div>
  );
}
