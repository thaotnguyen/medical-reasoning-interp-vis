"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  poolEntriesToItems,
  type ActivePoolItem,
  type GeometricPoolEntry,
} from "@/lib/labeler-active-pool";
import type { Case, Pipeline } from "@/lib/types";

interface UseSamplePoolResult {
  pool: ActivePoolItem[];
  currentItem: ActivePoolItem | null;
  currentCase: Case | null;
  selectedIndex: number;
  isLoading: boolean;
  navigateTo: (index: number) => void;
}

interface UseSamplePoolOptions {
  /** Kept for API back-compat (always treated as "geometric"). */
  pipeline?: Pipeline;
  /** Unused for geometric (pool is cross-model). */
  model?: string;
  /** Called once per cases file load, with all cases in it. */
  onCasesLoaded?: (model: string, dataset: string, cases: Case[]) => void;
}

const POOL_URL = "/data/pipelines/geometric/labeler-pool.json";
const casesUrl = (model: string) =>
  `/data/pipelines/geometric/cases/${model}.json`;

/**
 * Manages the geometric labeler pool (100 cases sampled across all models)
 * and lazily loads case files keyed by model. Subsequent visits hit the cache.
 */
export function useSamplePool({
  onCasesLoaded,
}: UseSamplePoolOptions = {}): UseSamplePoolResult {
  const [pool, setPool] = useState<ActivePoolItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // model -> Case[]
  const cacheRef = useRef<Map<string, Case[]>>(new Map());

  const onCasesLoadedRef = useRef(onCasesLoaded);
  useEffect(() => {
    onCasesLoadedRef.current = onCasesLoaded;
  });

  // Load the pool manifest.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(POOL_URL)
      .then((r) => (r.ok ? (r.json() as Promise<GeometricPoolEntry[]>) : []))
      .then((entries) => {
        if (cancelled) return;
        setPool(poolEntriesToItems(entries));
      })
      .catch(() => {
        if (cancelled) return;
        setPool([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clamp selection if pool shrinks.
  useEffect(() => {
    if (selectedIndex >= pool.length && pool.length > 0) setSelectedIndex(0);
    if (pool.length === 0) {
      setCurrentCase(null);
      setIsLoading(false);
    }
  }, [pool.length, selectedIndex]);

  const loadCase = useCallback(async (item: ActivePoolItem) => {
    let cases = cacheRef.current.get(item.model);
    if (!cases) {
      setIsLoading(true);
      try {
        const res = await fetch(casesUrl(item.model));
        if (!res.ok) throw new Error(`${res.status}`);
        cases = (await res.json()) as Case[];
        cacheRef.current.set(item.model, cases);
        onCasesLoadedRef.current?.(item.model, "geometric", cases);
      } catch {
        setCurrentCase(null);
        setIsLoading(false);
        return;
      }
    }
    setCurrentCase(cases[item.caseIndex] ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const item = pool[selectedIndex];
    if (!item) return;
    loadCase(item);
  }, [pool, selectedIndex, loadCase]);

  // Prefetch every distinct model's cases file once.
  useEffect(() => {
    if (pool.length === 0) return;
    const seen = new Set<string>();
    for (const item of pool) {
      if (seen.has(item.model)) continue;
      seen.add(item.model);
      if (cacheRef.current.has(item.model)) {
        onCasesLoadedRef.current?.(
          item.model,
          "geometric",
          cacheRef.current.get(item.model)!
        );
        continue;
      }
      fetch(casesUrl(item.model))
        .then((r) => (r.ok ? (r.json() as Promise<Case[]>) : null))
        .then((cases) => {
          if (!cases) return;
          if (!cacheRef.current.has(item.model)) {
            cacheRef.current.set(item.model, cases);
          }
          onCasesLoadedRef.current?.(item.model, "geometric", cases);
        })
        .catch(() => {});
    }
  }, [pool]);

  const navigateTo = useCallback(
    (index: number) => {
      if (pool.length === 0) return;
      setSelectedIndex(Math.max(0, Math.min(index, pool.length - 1)));
    },
    [pool.length]
  );

  return {
    pool,
    currentItem: pool[selectedIndex] ?? null,
    currentCase,
    selectedIndex,
    isLoading: isLoading || pool.length === 0,
    navigateTo,
  };
}
