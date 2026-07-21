"use client";

import { useCallback, useRef } from "react";
import type { RatingsStore } from "@/lib/labeling-types";
import type { Case, Metadata } from "@/lib/types";
import {
  exportRatingsAsJSON,
  exportRatingsAsCSV,
  importRatings,
} from "@/lib/labeling-storage";
import { Download, Upload } from "lucide-react";

interface ImportExportButtonsProps {
  ratings: RatingsStore;
  casesMap: Record<string, Case[]>;
  metadata: Metadata;
  onImport: (merged: RatingsStore) => void;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportButtons({
  ratings,
  casesMap,
  metadata,
  onImport,
}: ImportExportButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = useCallback(() => {
    const json = exportRatingsAsJSON(ratings);
    downloadBlob(json, "ratings.json", "application/json");
  }, [ratings]);

  const handleExportCSV = useCallback(() => {
    const csv = exportRatingsAsCSV(ratings, casesMap, metadata);
    downloadBlob(csv, "ratings.csv", "text/csv");
  }, [ratings, casesMap, metadata]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target?.result as string) as RatingsStore;
          const merged = importRatings(ratings, imported);
          onImport(merged);
        } catch {
          alert("Invalid JSON file. Please provide a valid ratings export.");
        }
      };
      reader.readAsText(file);
      // Reset so same file can be re-imported
      e.target.value = "";
    },
    [ratings, onImport]
  );

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportJSON}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export JSON
      </button>
      <button
        onClick={handleExportCSV}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
      <button
        onClick={handleImport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Import Ratings
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
