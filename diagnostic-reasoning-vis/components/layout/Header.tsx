"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import { Skeleton } from "@/components/ui/skeleton";
import { PIPELINES } from "@/lib/constants";

export function Header() {
  const { metadata, isLoading } = useMetadata();
  const { selectedModel, setModel, selectedPipeline, setPipeline } =
    useAppState();

  if (isLoading || !metadata) {
    return (
      <div className="flex items-center gap-4 px-6 py-3 border-b">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-36" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 border-b bg-background flex-wrap">
      <h1 className="text-sm font-semibold tracking-tight mr-1 md:mr-4">
        Diagnostic Reasoning Visualization
      </h1>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Model</span>
        <Select value={selectedModel} onValueChange={setModel}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metadata.model_order.map((slug) => {
              const model = metadata.models[slug];
              return (
                <SelectItem key={slug} value={slug} className="text-xs">
                  {model.display_name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

    </div>
  );
}
