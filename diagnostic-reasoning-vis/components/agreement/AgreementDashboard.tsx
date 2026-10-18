"use client";

import { useMemo, useState } from "react";
import type { RatingsStore } from "@/lib/labeling-types";
import type { Case, Metadata } from "@/lib/types";
import type { ActivePoolItem } from "@/lib/labeler-active-pool";
import { buildAgreementCasesMap } from "@/lib/agreement-scope";
import {
  computeCohenKappaNominal,
  computeConfusionMatrix,
  computeCategoryMetrics,
  collectPairedLabelsMulti,
} from "@/lib/agreement-stats";
import {
  AgreementScopeSelector,
  type ComparisonSource,
} from "./AgreementScopeSelector";
import { KappaCard } from "./KappaCard";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { CategoryAgreementTable } from "./CategoryAgreementTable";
import { ImportExportButtons } from "./ImportExportButtons";
import { ResetButtons } from "./ResetButtons";
import { DisagreementReview } from "./DisagreementReview";

interface RaterInfo {
  id: string;
  name: string;
}

interface AgreementDashboardProps {
  ratings: RatingsStore;
  raters: RaterInfo[];
  casesMap: Record<string, Case[]>;
  labelerPool: ActivePoolItem[];
  metadata: Metadata;
  onImport: (merged: RatingsStore) => void;
}

export function AgreementDashboard({
  ratings,
  raters,
  casesMap,
  labelerPool,
  metadata,
  onImport,
}: AgreementDashboardProps) {
  const defaultA = raters.length > 0 ? raters[0].id : "whitebox";
  const defaultB = raters.length > 0 ? "whitebox" : "whitebox";
  const [sourceA, setSourceA] = useState<ComparisonSource>(defaultA);
  const [sourceB, setSourceB] = useState<ComparisonSource>(defaultB);

  const numCategories = metadata.taxonomy.length;
  const agreementCasesMap = useMemo(
    () => buildAgreementCasesMap(casesMap, labelerPool),
    [casesMap, labelerPool]
  );

  const { labelsA, labelsB } = useMemo(() => {
    if (Object.keys(agreementCasesMap).length === 0) return { labelsA: [], labelsB: [] };

    if (sourceA === "whitebox") {
      if (sourceB === "whitebox") return { labelsA: [], labelsB: [] };
      const result = collectPairedLabelsMulti(ratings, agreementCasesMap, sourceB, "whitebox");
      return { labelsA: result.labelsB, labelsB: result.labelsA };
    }

    return collectPairedLabelsMulti(ratings, agreementCasesMap, sourceA, sourceB);
  }, [ratings, agreementCasesMap, sourceA, sourceB]);

  // Human rater ids (everything except the automated whitebox source).
  const humanIds = useMemo(
    () => raters.map((r) => r.id).filter((id) => id !== "whitebox"),
    [raters]
  );

  // Cohen's κ (chance-corrected): every human label vs the whitebox/AI label, pooled.
  // Also drives the confusion matrix + per-category metrics (humans vs whitebox).
  const humansVsAI = useMemo(() => {
    let a: number[] = [], b: number[] = [];
    for (const id of humanIds) {
      const r = collectPairedLabelsMulti(ratings, agreementCasesMap, id, "whitebox");
      a = a.concat(r.labelsA); b = b.concat(r.labelsB);
    }
    return { a, b, kappa: computeCohenKappaNominal(a, b, numCategories), n: a.length };
  }, [ratings, agreementCasesMap, humanIds, numCategories]);

  // Cohen's κ: every pair of humans, pooled.
  const humanVsHuman = useMemo(() => {
    let a: number[] = [], b: number[] = [];
    for (let i = 0; i < humanIds.length; i++) {
      for (let j = i + 1; j < humanIds.length; j++) {
        const r = collectPairedLabelsMulti(ratings, agreementCasesMap, humanIds[i], humanIds[j]);
        a = a.concat(r.labelsA); b = b.concat(r.labelsB);
      }
    }
    return { kappa: computeCohenKappaNominal(a, b, numCategories), n: a.length };
  }, [ratings, agreementCasesMap, humanIds, numCategories]);

  // Confusion matrix + per-category metrics: humans (rows) vs whitebox (columns).
  const matrix = useMemo(
    () => computeConfusionMatrix(humansVsAI.a, humansVsAI.b, numCategories),
    [humansVsAI, numCategories]
  );

  const categoryMetrics = useMemo(
    () => computeCategoryMetrics(humansVsAI.a, humansVsAI.b, numCategories),
    [humansVsAI, numCategories]
  );

  // Cohen's κ for the pair selected in the Review section.
  const cohenKappaSelected = useMemo(
    () => computeCohenKappaNominal(labelsA, labelsB, numCategories),
    [labelsA, labelsB, numCategories]
  );

  const getSourceLabel = (s: ComparisonSource) => {
    if (s === "whitebox") return "Whitebox";
    return raters.find((r) => r.id === s)?.name ?? s.slice(0, 8);
  };

  const sourceALabel = getSourceLabel(sourceA);
  const sourceBLabel = getSourceLabel(sourceB);
  const hasData = humansVsAI.n > 0 || humanVsHuman.n > 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-end flex-wrap gap-4">
        <ImportExportButtons
          ratings={ratings}
          casesMap={casesMap}
          metadata={metadata}
          onImport={onImport}
        />
        <ResetButtons />
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
            Agreement appears once raters and the whitebox model have labels for
            the same sentences. Label more sentences to populate this view.
          </p>
        </div>
      ) : (
        <>
          {/* Agreement metric cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KappaCard
              title="Cohen's κ: Humans vs AI"
              kappa={humansVsAI.kappa}
              n={humansVsAI.n}
            />
            <KappaCard
              title="Cohen's κ: Human vs Human"
              kappa={humanVsHuman.kappa}
              n={humanVsHuman.n}
            />
          </div>

          {/* Confusion matrix + per-category metrics (humans vs whitebox) share a box */}
          <div className="border rounded-lg p-4">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium mb-3">Confusion Matrix</h3>
                <ConfusionMatrix matrix={matrix} taxonomy={metadata.taxonomy} />
              </div>
              <div className="lg:shrink-0 min-w-0">
                <h3 className="text-sm font-medium mb-3">Per-Category Metrics</h3>
                <CategoryAgreementTable
                  metrics={categoryMetrics}
                  taxonomy={metadata.taxonomy}
                />
              </div>
            </div>
          </div>

          {/* Review: pick any pair, see their Cohen's κ + case-by-case sentences */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-medium">Review</h3>
              <AgreementScopeSelector
                raters={raters}
                sourceA={sourceA}
                sourceB={sourceB}
                onSourceAChange={setSourceA}
                onSourceBChange={setSourceB}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cohen&apos;s κ ({sourceALabel} vs {sourceBLabel}):{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {isNaN(cohenKappaSelected) ? "---" : cohenKappaSelected.toFixed(3)}
              </span>
              {" · "}
              {labelsA.length} co-labeled sentence{labelsA.length === 1 ? "" : "s"}
            </p>
            <DisagreementReview
              ratings={ratings}
              casesMap={agreementCasesMap}
              sourceA={sourceA}
              sourceB={sourceB}
              sourceALabel={sourceALabel}
              sourceBLabel={sourceBLabel}
              taxonomy={metadata.taxonomy}
            />
          </div>
        </>
      )}
    </div>
  );
}
