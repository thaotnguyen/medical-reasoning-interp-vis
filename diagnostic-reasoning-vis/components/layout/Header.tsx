"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMetadata } from "@/hooks/useMetadata";
import { useAppState } from "@/hooks/useAppState";
import { usePipelineTaxonomy } from "@/hooks/usePipelineTaxonomy";
import { Skeleton } from "@/components/ui/skeleton";
import { PIPELINES } from "@/lib/constants";

export function Header() {
  const { metadata, isLoading } = useMetadata();
  const { selectedModel, setModel, selectedPipeline, setPipeline } =
    useAppState();
  const { raw: taxonomy } = usePipelineTaxonomy(selectedPipeline);
  const pathname = usePathname();
  // The human-rating tools (labeler/agreement) are pinned to the shipped 6-model data,
  // so the 6/10-model toggle only appears on the explorer/browser views.
  const showPipelineToggle =
    PIPELINES.length > 1 &&
    !pathname.startsWith("/labeler") &&
    !pathname.startsWith("/agreement");

  // The dropdown shows exactly the models that contribute to the selected pipeline.
  // Order = metadata.model_order first (keeps the 6-model view stable), then any extras.
  const modelOrder = useMemo(() => metadata?.model_order ?? [], [metadata]);
  const models = useMemo(() => {
    const pipelineModels = taxonomy?.models ?? modelOrder;
    return [
      ...modelOrder.filter((m) => pipelineModels.includes(m)),
      ...pipelineModels.filter((m) => !modelOrder.includes(m)),
    ];
  }, [taxonomy?.models, modelOrder]);

  // If the current model isn't part of the selected pipeline, snap to the first one.
  useEffect(() => {
    if (models.length && !models.includes(selectedModel)) {
      setModel(models[0]);
    }
  }, [models, selectedModel, setModel]);

  // The human-rating tools only have 6-model data; if we land there while the 10-model
  // taxonomy is active, snap back so those pages never request missing pipeline data.
  useEffect(() => {
    if (!showPipelineToggle && selectedPipeline === "tenmodel") {
      setPipeline("dedup");
    }
  }, [showPipelineToggle, selectedPipeline, setPipeline]);

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

      {showPipelineToggle && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Taxonomy</span>
          <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
            {PIPELINES.map((p) => {
              const active = p.id === selectedPipeline;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPipeline(p.id)}
                  aria-pressed={active}
                  className={
                    "px-2.5 py-1 text-xs rounded-[5px] transition-colors " +
                    (active
                      ? "bg-background shadow-sm font-medium"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {p.short}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Model</span>
        <Select value={selectedModel} onValueChange={setModel}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((slug) => {
              const model = metadata.models[slug];
              return (
                <SelectItem key={slug} value={slug} className="text-xs">
                  {model?.display_name ?? slug}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
