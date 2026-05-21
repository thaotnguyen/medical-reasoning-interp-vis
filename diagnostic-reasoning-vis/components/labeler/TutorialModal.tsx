"use client";

import { useState } from "react";
import type { TaxonomyItem, Pipeline } from "@/lib/types";
import { getTaxonomyReferences } from "@/lib/taxonomy-reference";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

interface TutorialModalProps {
  taxonomy: TaxonomyItem[];
  pipeline: Pipeline;
  onComplete: (name: string) => void;
}

export function TutorialModal({
  taxonomy,
  pipeline,
  onComplete,
}: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  const references = getTaxonomyReferences(pipeline);
  // Step 0 = welcome, steps 1..N = taxonomy categories, last = name entry
  const totalSteps = references.length + 2;
  const isWelcome = step === 0;
  const isNameStep = step === totalSteps - 1;
  const taxonomyStep = !isWelcome && !isNameStep ? step - 1 : -1;

  const ref = taxonomyStep >= 0 ? references[taxonomyStep] : null;
  const tax = taxonomyStep >= 0 ? taxonomy[taxonomyStep] : null;
  const numStates = Math.max(taxonomy.length, references.length);
  const lastKey = Math.min(numStates, 9);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {isWelcome && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">
                Welcome to the Diagnostic Reasoning Labeler
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You&apos;ll be labeling sentences from AI medical reasoning
                traces with cognitive function categories. This helps us measure
                how well automated labeling matches human judgment.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each unit in a <strong>{pipeline}</strong> reasoning trace
                belongs to one of <strong>{numStates} categories</strong>. The
                next few screens explain each category with examples. Take your
                time &mdash; understanding these categories is key to consistent
                labeling.
              </p>
              <div className="pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Quick overview of all categories:
                </p>
                <div className="grid gap-1.5">
                  {taxonomy.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="font-medium">{i + 1}. {t.short_name}</span>
                      <span className="text-muted-foreground">
                        &mdash; {references[i]?.shortDescription}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {ref && tax && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: tax.color }}
                >
                  {taxonomyStep + 1}
                </span>
                <div>
                  <h2 className="text-xl font-bold">{tax.short_name}</h2>
                  <p className="text-xs text-muted-foreground">{tax.label}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed">{ref.shortDescription}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ref.longDescription}
              </p>

              {/* Positive example */}
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  This IS {tax.short_name}
                </div>
                <p className="text-sm italic">&ldquo;{ref.positiveExample}&rdquo;</p>
                <p className="text-xs text-muted-foreground">
                  {ref.positiveExplanation}
                </p>
              </div>

              {/* Negative example */}
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                  This is NOT {tax.short_name}
                </div>
                <p className="text-sm italic">&ldquo;{ref.negativeExample}&rdquo;</p>
                <p className="text-xs text-muted-foreground">
                  {ref.negativeExplanation}
                </p>
              </div>
            </div>
          )}

          {isNameStep && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">You&apos;re ready to start!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter your name below. This identifies your ratings for
                inter-rater reliability analysis. You can access the category
                reference at any time using the{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                  ?
                </kbd>{" "}
                key.
              </p>

              {/* Keyboard shortcuts */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Keyboard Shortcuts
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {[
                    { keys: `1 – ${lastKey}`, desc: "Assign category to focused sentence" },
                    { keys: "0  or  ⌫", desc: "Clear label" },
                    { keys: "↑ ↓  or  j k", desc: "Move between sentences" },
                    { keys: "Tab", desc: "Jump to next unlabeled" },
                    { keys: "⇧ Tab", desc: "Jump to previous unlabeled" },
                    { keys: "[  ]", desc: "Previous / next case" },
                    { keys: "?", desc: "Open category reference" },
                  ].map((s) => (
                    <div key={s.keys} className="flex items-baseline gap-2 text-xs">
                      <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">
                        {s.keys}
                      </kbd>
                      <span className="text-muted-foreground">{s.desc}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  After labeling a sentence, focus automatically advances to the next unlabeled one.
                  You can also click to label.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your name</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Alice"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) onComplete(name.trim());
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-8 py-4 border-t">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md hover:bg-accent transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <span className="text-[10px] text-muted-foreground">
            {step + 1} / {totalSteps}
          </span>

          {isNameStep ? (
            <button
              onClick={() => name.trim() && onComplete(name.trim())}
              disabled={!name.trim()}
              className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Start Labeling
            </button>
          ) : (
            <button
              onClick={() => setStep(Math.min(totalSteps - 1, step + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
