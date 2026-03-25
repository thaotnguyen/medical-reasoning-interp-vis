"use client";

import { useMemo, useState } from "react";
import type { RatingsStore } from "@/lib/labeling-types";
import type { Case, Metadata } from "@/lib/types";
import {
  computeCohenKappa,
  computeConfusionMatrix,
  computeCategoryMetrics,
  computeFleissKappa,
  collectPairedLabels,
  buildFleissMatrix,
} from "@/lib/agreement-stats";
import {
  AgreementScopeSelector,
  type ComparisonSource,
} from "./AgreementScopeSelector";
import { KappaCard } from "./KappaCard";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { CategoryAgreementTable } from "./CategoryAgreementTable";
import { ImportExportButtons } from "./ImportExportButtons";

interface RaterInfo {
  id: string;
  name: string;
}

interface AgreementDashboardProps {
  ratings: RatingsStore;
  raters: RaterInfo[];
  cases: Case[] | undefined;
  casesMap: Record<string, Case[]>;
  metadata: Metadata;
  model: string;
  dataset: string;
  onImport: (merged: RatingsStore) => void;
}

export function AgreementDashboard({
  ratings,
  raters,
  cases,
  casesMap,
  metadata,
  model,
  dataset,
  onImport,
}: AgreementDashboardProps) {
  const defaultA = raters.length > 0 ? raters[0].id : "whitebox";
  const defaultB = raters.length > 0 ? "whitebox" : "whitebox";
  const [sourceA, setSourceA] = useState<ComparisonSource>(defaultA);
  const [sourceB, setSourceB] = useState<ComparisonSource>(defaultB);

  const numCategories = metadata.taxonomy.length;

  const { labelsA, labelsB } = useMemo(() => {
    if (!cases) return { labelsA: [], labelsB: [] };

    if (sourceA === "whitebox") {
      if (sourceB === "whitebox") return { labelsA: [], labelsB: [] };
      const result = collectPairedLabels(ratings, cases, model, dataset, sourceB, "whitebox");
      return { labelsA: result.labelsB, labelsB: result.labelsA };
    }

    return collectPairedLabels(ratings, cases, model, dataset, sourceA, sourceB);
  }, [ratings, cases, model, dataset, sourceA, sourceB]);

  const cohenKappa = useMemo(
    () => computeCohenKappa(labelsA, labelsB, numCategories),
    [labelsA, labelsB, numCategories]
  );

  const matrix = useMemo(
    () => computeConfusionMatrix(labelsA, labelsB, numCategories),
    [labelsA, labelsB, numCategories]
  );

  const categoryMetrics = useMemo(
    () => computeCategoryMetrics(labelsA, labelsB, numCategories),
    [labelsA, labelsB, numCategories]
  );

  // Fleiss' kappa across all raters who have labels
  const raterIds = useMemo(() => raters.map((r) => r.id), [raters]);

  const fleissKappa = useMemo(() => {
    if (!cases || raterIds.length === 0) return NaN;
    const fleissMatrix = buildFleissMatrix(
      ratings,
      cases,
      model,
      dataset,
      raterIds,
      true,
      numCategories
    );
    return computeFleissKappa(fleissMatrix, numCategories);
  }, [ratings, cases, model, dataset, raterIds, numCategories]);

  const fleissN = useMemo(() => {
    if (!cases || raterIds.length === 0) return 0;
    return buildFleissMatrix(ratings, cases, model, dataset, raterIds, true, numCategories).length;
  }, [ratings, cases, model, dataset, raterIds, numCategories]);

  const getSourceLabel = (s: ComparisonSource) => {
    if (s === "whitebox") return "Whitebox";
    return raters.find((r) => r.id === s)?.name ?? s.slice(0, 8);
  };

  const sourceALabel = getSourceLabel(sourceA);
  const sourceBLabel = getSourceLabel(sourceB);
  const hasData = labelsA.length > 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <AgreementScopeSelector
          raters={raters}
          sourceA={sourceA}
          sourceB={sourceB}
          onSourceAChange={setSourceA}
          onSourceBChange={setSourceB}
        />
        <ImportExportButtons
          ratings={ratings}
          casesMap={casesMap}
          metadata={metadata}
          onImport={onImport}
        />
      </div>

      {raters.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No raters found</p>
          <p className="text-sm">
            Ratings will appear here once raters label sentences in the Labeler
            tab and data syncs to the server.
          </p>
        </div>
      ) : !hasData ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-2">No co-labeled data yet</p>
          <p className="text-sm">
            Both selected sources need labels for the same sentences.
            Try a different comparison pair, or label more sentences.
          </p>
        </div>
      ) : (
        <>
          {/* Kappa cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KappaCard
              title={`Cohen's \u03BA: ${sourceALabel} vs ${sourceBLabel}`}
              kappa={cohenKappa}
              n={labelsA.length}
            />
            <KappaCard
              title={`Fleiss' \u03BA: All ${raterIds.length} raters + Whitebox`}
              kappa={fleissKappa}
              n={fleissN}
            />
          </div>

          {/* Confusion matrix */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">Confusion Matrix</h3>
            <ConfusionMatrix
              matrix={matrix}
              taxonomy={metadata.taxonomy}
              sourceALabel={sourceALabel}
              sourceBLabel={sourceBLabel}
            />
          </div>

          {/* Per-category metrics */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">
              Per-Category Metrics ({sourceALabel} as reference)
            </h3>
            <CategoryAgreementTable
              metrics={categoryMetrics}
              taxonomy={metadata.taxonomy}
            />
          </div>
        </>
      )}
    </div>
  );
}
