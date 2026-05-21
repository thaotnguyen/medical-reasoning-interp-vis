"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getRaterId,
  getRaterName,
  isTutorialDone,
  createRaterIdentity,
  markTutorialDone,
} from "@/lib/rater-identity";

interface RaterIdentity {
  raterId: string | null;       // name-based slug (e.g. "alice")
  raterName: string | null;     // display name (e.g. "Alice")
  needsTutorial: boolean;
  isReady: boolean;             // false during SSR hydration
  completeTutorial: (name: string) => string;
  skipTutorial: () => void;
}

/**
 * Per-pipeline rater identity. The pipeline argument (default "sentence")
 * scopes the "tutorial done" flag so each pipeline shows its own tutorial
 * once.
 */
export function useRaterIdentity(pipeline: string = "sentence"): RaterIdentity {
  const [raterId, setRaterId] = useState<string | null>(null);
  const [raterName, setRaterName] = useState<string | null>(null);
  const [needsTutorial, setNeedsTutorial] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from cookies/localStorage on mount and on pipeline change.
  useEffect(() => {
    const id = getRaterId();
    const name = getRaterName();
    const tutorialDone = isTutorialDone(pipeline);

    setRaterId(id);
    setRaterName(name);
    setNeedsTutorial(!id || !tutorialDone);
    setIsReady(true);
  }, [pipeline]);

  const completeTutorial = useCallback(
    (name: string): string => {
      const id = createRaterIdentity(name, pipeline);
      setRaterId(id);
      setRaterName(name.trim());
      setNeedsTutorial(false);
      return id;
    },
    [pipeline]
  );

  const skipTutorial = useCallback(() => {
    markTutorialDone(pipeline);
    setNeedsTutorial(false);
  }, [pipeline]);

  return { raterId, raterName, needsTutorial, isReady, completeTutorial, skipTutorial };
}
