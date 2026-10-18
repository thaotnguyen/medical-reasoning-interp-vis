"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLabelingState } from "@/hooks/useLabelingState";
import { getRaterId } from "@/lib/rater-identity";

/**
 * "Reset for me" deletes this rater's ratings in the live round. "Reset for everyone" starts a
 * new round, so every rater starts from nothing; earlier rounds stay archived in blob storage.
 */
export function ResetButtons() {
  const [busy, setBusy] = useState(false);

  const reset = async (everyone: boolean) => {
    const raterId = getRaterId();
    if (!everyone && !raterId) {
      alert("Enter your name in the labeler first, so there is a rater to reset.");
      return;
    }
    const question = everyone
      ? "Start a new labeling round for everyone? Every rater's current ratings stop counting."
      : `Delete all of your ratings (${raterId}) in this round?`;
    if (!window.confirm(question)) return;

    setBusy(true);
    const store = useLabelingState.getState();
    const res = everyone
      ? await fetch("/api/ratings/round", { method: "POST" })
      : await fetch(`/api/ratings?raterId=${encodeURIComponent(raterId!)}`, { method: "DELETE" });
    // A rater who never synced has nothing on the server to delete.
    if (!res.ok && !(res.status === 404 && !everyone)) {
      setBusy(false);
      alert("Reset failed: the ratings server did not accept it.");
      return;
    }
    if (everyone) store.adoptRound((await res.json()).round);
    else store.clearRater(raterId!);
    window.location.reload();
  };

  const style =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md transition-colors disabled:opacity-50";
  return (
    <div className="flex items-center gap-2">
      <button disabled={busy} onClick={() => reset(false)} className={`${style} hover:bg-accent`}>
        <RotateCcw className="w-3.5 h-3.5" />
        Reset for me
      </button>
      <button
        disabled={busy}
        onClick={() => reset(true)}
        className={`${style} border-red-300 text-red-700 hover:bg-red-50`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset for everyone
      </button>
    </div>
  );
}
