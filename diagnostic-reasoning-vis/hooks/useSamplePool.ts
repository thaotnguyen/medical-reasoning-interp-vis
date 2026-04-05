"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useSWRImmutable from "swr/immutable";
import {
  buildIndexedLabelerPool,
  type IndexedPoolItem,
  type LabelerPoolManifest,
} from "@/lib/labeler-pool";
import type { Case } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UseSamplePoolResult {
  pool: IndexedPoolItem[];
  currentItem: IndexedPoolItem | null;
  currentCase: Case | null;
  selectedIndex: number;
  isLoading: boolean;
  navigateTo: (index: number) => void;
}

interface UseSamplePoolOptions {
  /** Called once per session when a cases file is first loaded, with all cases in it. */
  onCasesLoaded?: (model: string, dataset: string, cases: Case[]) => void;
}

/**
 * Manages the deterministic sample pool and lazy-loads case data.
 * Caches fetched case files so repeat visits are instant.
 */
export function useSamplePool({ onCasesLoaded }: UseSamplePoolOptions = {}): UseSamplePoolResult {
  const {
    data: manifest,
    error,
    isLoading: manifestLoading,
  } = useSWRImmutable<LabelerPoolManifest>("/data/labeler-pool.json", fetcher);
  const pool = useMemo(
    () => (manifest ? buildIndexedLabelerPool(manifest) : []),
    [manifest]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cache: model_dataset -> Case[]
  const cacheRef = useRef<Map<string, Case[]>>(new Map());

  // Keep a stable ref to the callback to avoid re-creating loadCase
  const onCasesLoadedRef = useRef(onCasesLoaded);
  useEffect(() => { onCasesLoadedRef.current = onCasesLoaded; });

  // Reset selection if the manifest changes and the current index is invalid.
  useEffect(() => {
    if (selectedIndex >= pool.length && pool.length > 0) {
      setSelectedIndex(0);
    }
  }, [pool.length, selectedIndex]);

  useEffect(() => {
    if (manifestLoading) return;
    if (!manifest || error) {
      setCurrentCase(null);
      setIsLoading(false);
      return;
    }
    if (pool.length === 0) {
      setCurrentCase(null);
      setIsLoading(false);
    }
  }, [manifest, manifestLoading, error, pool.length]);

  // Fetch case data for current pool item
  const loadCase = useCallback(async (item: IndexedPoolItem) => {
    const key = `${item.model}_${item.dataset}`;
    let cases = cacheRef.current.get(key);

    if (!cases) {
      setIsLoading(true);
      try {
        const res = await fetch(`/data/cases/${key}.json`);
        if (!res.ok) throw new Error(`${res.status}`);
        cases = (await res.json()) as Case[];
        cacheRef.current.set(key, cases);
        // Notify caller with ALL cases so it can populate its cache up-front
        onCasesLoadedRef.current?.(item.model, item.dataset, cases);
      } catch {
        setCurrentCase(null);
        setIsLoading(false);
        return;
      }
    }

    setCurrentCase(cases[item.caseIndex] ?? null);
    setIsLoading(false);
  }, []);

  // Load case when selection changes
  useEffect(() => {
    const item = pool[selectedIndex];
    if (!item) return;
    loadCase(item);
  }, [pool, selectedIndex, loadCase]);

  // Background-prefetch every unique case file as soon as the pool is known.
  // This populates caseInfo for ALL pool items immediately, so the sidebar can
  // show completion status without requiring the user to navigate to each case.
  useEffect(() => {
    if (pool.length === 0) return;
    const seen = new Set<string>();
    for (const item of pool) {
      const fileKey = `${item.model}_${item.dataset}`;
      if (seen.has(fileKey)) continue;
      seen.add(fileKey);
      if (cacheRef.current.has(fileKey)) {
        // Already fetched (e.g. by loadCase) — fire callback now so caseInfo is populated
        onCasesLoadedRef.current?.(item.model, item.dataset, cacheRef.current.get(fileKey)!);
      } else {
        fetch(`/data/cases/${fileKey}.json`)
          .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Case[]>; })
          .then(cases => {
            if (!cacheRef.current.has(fileKey)) cacheRef.current.set(fileKey, cases);
            onCasesLoadedRef.current?.(item.model, item.dataset, cases);
          })
          .catch(() => {});
      }
    }
  }, [pool]);

  const navigateTo = useCallback((index: number) => {
    if (pool.length === 0) return;
    setSelectedIndex(Math.max(0, Math.min(index, pool.length - 1)));
  }, [pool.length]);

  return {
    pool,
    currentItem: pool[selectedIndex] ?? null,
    currentCase,
    selectedIndex,
    isLoading: manifestLoading || isLoading || (!error && pool.length === 0),
    navigateTo,
  };
}
