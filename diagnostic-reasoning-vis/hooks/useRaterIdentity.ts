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
  raterId: string | null;
  raterName: string | null;
  needsTutorial: boolean;
  isReady: boolean; // false during SSR hydration
  completeTutorial: (name: string) => string; // returns the new raterId
  skipTutorial: () => void;
}

export function useRaterIdentity(): RaterIdentity {
  const [raterId, setRaterId] = useState<string | null>(null);
  const [raterName, setRaterName] = useState<string | null>(null);
  const [needsTutorial, setNeedsTutorial] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Hydrate from cookies/localStorage on mount
  useEffect(() => {
    const id = getRaterId();
    const name = getRaterName();
    const tutorialDone = isTutorialDone();

    setRaterId(id);
    setRaterName(name);
    setNeedsTutorial(!id || !tutorialDone);
    setIsReady(true);
  }, []);

  const completeTutorial = useCallback((name: string): string => {
    const existingId = getRaterId();
    let id: string;

    if (existingId) {
      // Rater already exists (just redo tutorial), keep the same ID
      id = existingId;
      markTutorialDone();
    } else {
      id = createRaterIdentity(name);
    }

    setRaterId(id);
    setRaterName(name);
    setNeedsTutorial(false);
    return id;
  }, []);

  const skipTutorial = useCallback(() => {
    markTutorialDone();
    setNeedsTutorial(false);
  }, []);

  return { raterId, raterName, needsTutorial, isReady, completeTutorial, skipTutorial };
}
