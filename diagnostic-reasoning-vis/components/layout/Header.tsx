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

export function Header() {
  const { metadata, isLoading } = useMetadata();
  const { selectedModel, selectedDataset, setModel, setDataset } =
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
    <div className="flex items-center gap-4 px-6 py-3 border-b bg-background">
      <h1 className="text-sm font-semibold tracking-tight mr-4">
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
              const isWhiteBox = model.has_activations;
              return (
                <SelectItem key={slug} value={slug} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    {model.display_name}
                    <span
                      className={`inline-flex items-center rounded px-1 py-0.5 text-[10px] leading-none font-medium ${
                        isWhiteBox
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {isWhiteBox ? "white-box" : "black-box"}
                    </span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Dataset</span>
        <Select value={selectedDataset} onValueChange={setDataset}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metadata.dataset_order.map((slug) => (
              <SelectItem key={slug} value={slug} className="text-xs">
                {metadata.datasets[slug]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
