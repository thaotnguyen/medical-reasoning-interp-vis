"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
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
import type { Pipeline } from "@/lib/types";

/** Solid black (currentColor) home glyph shown instead of the title on phones. */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3.172 2.25 11.03a.75.75 0 0 0 .94 1.17l1.06-.85V20a1 1 0 0 0 1 1h4.5a.75.75 0 0 0 .75-.75V15.5h3.5v4.75a.75.75 0 0 0 .75.75h4.5a1 1 0 0 0 1-1v-8.65l1.06.85a.75.75 0 1 0 .94-1.17L12 3.172Z" />
    </svg>
  );
}

export function Header() {
  const { metadata, isLoading } = useMetadata();
  const { selectedModel, setModel, selectedPipeline, setPipeline } =
    useAppState();
  const { raw: taxonomy } = usePipelineTaxonomy(selectedPipeline);
  const pathname = usePathname();
  // Explorer / Plots / Browser have data for both taxonomies. The human-rating tools are
  // pinned to the 6-model data (only dedup has a labeler pool), so the toggle is hidden
  // there and the selection snaps back if we arrive with the 10-model taxonomy active.
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

  // Snap back to the 6-model taxonomy on the rating tools. Checking != "dedup" rather than
  // naming one pipeline matters now that there are four: only dedup has a labeler pool.
  useEffect(() => {
    if (!showPipelineToggle && selectedPipeline !== "dedup") {
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
    // nowrap so the whole bar stays on one row on phones; each control shrinks instead.
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 border-b bg-background flex-nowrap">
      {/* Title doubles as the home link. Phones get just the icon so the row fits. */}
      <Link
        href="/"
        aria-label="Diagnostic Reasoning Visualization — home"
        className="shrink-0 mr-0 md:mr-4 flex items-center text-foreground hover:opacity-70 transition-opacity"
      >
        <HomeIcon className="w-5 h-5 md:hidden" />
        <span className="hidden md:inline text-sm font-semibold tracking-tight">
          Diagnostic Reasoning Visualization
        </span>
      </Link>

      {showPipelineToggle && (
        <div className="flex items-center gap-2 min-w-0 shrink">
          <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
            Taxonomy
          </span>
          <Select
            value={selectedPipeline}
            onValueChange={(v) => setPipeline(v as Pipeline)}
          >
            <SelectTrigger className="h-8 text-xs w-[104px] md:w-[132px] min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINES.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-none">
        <span className="hidden md:inline text-xs text-muted-foreground shrink-0">
          Model
        </span>
        <Select value={selectedModel} onValueChange={setModel}>
          {/* min-w-0 lets the trigger shrink; the value line-clamps to one line with an
              ellipsis, so a long name never pushes the row to a second line. */}
          <SelectTrigger className="h-8 text-xs w-full md:w-[200px] min-w-0">
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
