# Technical Context & Implementation Notes

## Project Overview

Interactive Next.js website visualizing reasoning traces from clinical diagnostic models. The source data comes from the BMJ-COT-AI project (`~/Documents/GitHub-Projects/bmj-cot-ai/`), where models solve clinical vignettes and their internal activations are extracted, clustered via SAE, and annotated with a universal taxonomy.

## Data Pipeline

### Source Data (in `~/Documents/GitHub-Projects/bmj-cot-ai/`)

**Activation pickle files** (`activations/activations_{model}_{size}_{layer}.pkl`):

- Tuple of `(activations_ndarray, sentences_list, reference_row)`
- 6 models, MedQA only, 7K-16K sentences each
- Activation dimensions vary by model (1536 to 5120)

| Model                         | Layer | Activation Dim | Sentences |
| ----------------------------- | ----- | -------------- | --------- |
| deepseek-r1-distill-qwen-1.5b | 16    | 1,536          | 10,187    |
| gpt-oss-20b                   | 17    | 2,880          | 16,360    |
| deepseek-r1-distill-llama-8b  | 14    | 4,096          | 11,950    |
| huatuogpt-o1-8b               | 18    | 4,096          | 13,740    |
| deepseek-r1-distill-qwen-14b  | 20    | 5,120          | 13,397    |
| qwq-32b                       | 27    | 5,120          | 14,070    |

**SAE cluster metadata** (`vars/sae_topk_results_{model}_layer{N}.json`):

- 37 files across 6 models, multiple layers each
- Structure: `{clustering_method, model_id, layer, results_by_cluster_size, best_cluster}`
- Inside `results_by_cluster_size[N].all_results[0]`:
  - `categories`: list of `[cluster_id, title, description]`
  - `completeness_responses`: sentence-to-cluster assignments with `{sentence_idx, sentence, cluster_id, title, completeness_score}`
  - Accuracy/F1/precision/recall metrics per cluster
- `best_cluster.size` indicates the optimal cluster count (10-20 depending on model)
- Each model's activation layer has a matching SAE file (all verified)

**Trace/label data** (`figure_data/{white_box_edited,black_box_edited}/{model}/{dataset}_with_second_responses/results.labeled.json`):

- Top-level keys: `state_order`, `state_to_idx`, `idx_to_universal`, `universal_taxonomy`, `traces`
- Each trace: `{pmcid, sample_index, question_id, case_prompt, true_diagnosis, predicted_diagnosis, reasoning_trace, verification_response, verified_correct, label_json, sequence, sequence_length, original_sequence_idx}`
- `label_json`: dict keyed by 1-based string index, each value has `{function, sentence}`
- `sequence`: array of state indices (0-7)
- `original_sequence_idx`: array of SAE cluster IDs per sentence position
- White box models: deepseek-r1-distill-llama-8b, deepseek-r1-distill-qwen-1.5b, deepseek-r1-distill-qwen-14b, gpt-oss-20b, huatuogpt-o1-8b, qwq-32b
- Black box models (no activations): claude-3-7-sonnet-20250219, grok-3-mini

**Graded responses** (`figure_data/{box}/{model}/{dataset}_with_second_responses/responses_{model}.graded.json`):

- Array of `{question_id, pmcid, sample_index, dataset_name, dataset_split, question, full_response, gold_answer, extracted_answer, is_correct, similarity_score, ...}`

**MedMCQA duplicate handling**: The medmcqa-filtered dataset has duplicate questions that must be filtered. See `get_dupes()` in the preprocessing notebook for the exact logic — it cross-references both graded.json and results.labeled.json to identify and remove duplicates by question_id and case_prompt.

### Preprocessing Notebook

Located at `~/Documents/GitHub-Projects/notebooks/2026-02-11-13-31_DataPreprocessing.ipynb`

Steps:

1. Load activation pickle files, parse model names and layers from filenames
2. Load SAE cluster metadata from `vars/sae_topk_results_*.json`, using `best_cluster.size` to pick optimal cluster count
3. Load trace data (`results.labeled.json`) and graded responses for all 8 models × 3 datasets
4. For models with activations on MedQA: **strict match** — only keep cases where 100% of sentences in `label_json` have an exact string match in the activation sentences list
5. Compute t-SNE (scikit-learn, seed=2026, perplexity=30, max_iter=1000) on all unique matched activation vectors
6. Export compact JSON files to `public/data/`

### Current Matching Results (strict 100%)

| Model                         | MedQA Cases | t-SNE Points |
| ----------------------------- | ----------- | ------------ |
| deepseek-r1-distill-llama-8b  | 163         | 3,696        |
| deepseek-r1-distill-qwen-1.5b | 158         | 2,958        |
| deepseek-r1-distill-qwen-14b  | 128         | 3,158        |
| huatuogpt-o1-8b               | 40          | 959          |
| qwq-32b                       | 7           | 181          |
| gpt-oss-20b                   | 3           | 35           |

Models without activations (Claude, Grok) have all 512 MedQA cases, plus full medmcqa-filtered (~1187) and nejm-cpc (~302) cases.

## Preprocessed Data Format (in `public/data/`)

### `metadata.json` (83KB)

```json
{
  "models": {
    "model-slug": {
      "display_name": "Human Name",
      "has_activations": true,
      "layer": 14,
      "num_clusters": 18,
      "clusters": { "0": { "title": "...", "description": "..." }, ... },
      "datasets": {
        "medqa": { "display_name": "MedQA", "has_tsne": true, "num_cases": 163 }
      }
    }
  },
  "datasets": { "medqa": "MedQA", "medmcqa-filtered": "MedMCQA", "nejm-cpc": "NEJM CPC" },
  "taxonomy": [
    { "label": "Orchestration / meta-control", "color": "#9467bd", "short_name": "Orchestration" },
    ...7 items, indexed 0-6
  ],
  "model_order": ["deepseek-r1-distill-llama-8b", ...8 models],
  "dataset_order": ["medqa", "medmcqa-filtered", "nejm-cpc"]
}
```

### `cases/{model}_{dataset}.json` (0.01-8MB)

Array of compact case objects:

```json
{
  "id": "pmcid_hash",
  "qid": 254.0,
  "prompt": "A previously healthy 32-year-old...",
  "true_dx": "Cystic medial necrosis",
  "pred_dx": "Parasitic pneumonia",
  "correct": false,
  "sentences": [
    { "s": "sentence text", "t": 1, "c": "17", "i": 1, "x": -34.2, "y": 81.89 }
  ]
}
```

- `t`: taxonomy index (0-6), references `metadata.taxonomy[t]`
- `c`: SAE cluster ID (string), references `metadata.models[model].clusters[c]`
- `i`: 1-based sentence index from original label_json
- `x`/`y`: t-SNE coordinates (null if no activation match / non-MedQA)

### `tsne/{model}.json` (0.003-0.11MB)

Flat array of tuples for scatter plot rendering:

```json
[[x, y, taxonomy_idx, cluster_id, case_idx, sent_idx], ...]
```

- `case_idx`: index into the cases array for this model's MedQA data
- `sent_idx`: index into that case's sentences array
- Only exists for 6 models with activations, only MedQA

## Naming Conventions

```
Models:
  "deepseek-r1-distill-llama-8b" → "Llama 8B (DSR1)"
  "deepseek-r1-distill-qwen-1.5b" → "Qwen 1.5B (DSR1)"
  "deepseek-r1-distill-qwen-14b" → "Qwen 14B (DSR1)"
  "gpt-oss-20b" → "GPT OSS 20B"
  "huatuogpt-o1-8b" → "HuatuoGPT O1 8B"
  "qwq-32b" → "QWQ 32B"
  "grok-3-mini" → "Grok 3 Mini"
  "claude-3-7-sonnet-20250219" → "Claude 3.5 Sonnet"

Taxonomy (index → label → short_name → color):
  0: "Orchestration / meta-control" → "Orchestration" → #9467bd
  1: "Case evidence extraction (patient-specific facts)" → "Case Evidence Extraction" → #ff7f0e
  2: "Evidence processing (salience + interpretation + summarization)" → "Evidence Processing" → #1f77b4
  3: "Medical knowledge / templates / criteria (general facts)" → "Recalling Medical Knowledge" → #d62728
  4: "Hypothesis generation (differential expansion)" → "Hypothesis Generation" → #e377c2
  5: "Hypothesis evaluation & narrowing (support OR exclude)" → "Hypothesis Evaluation" → #2ca02c
  6: "Final answer commitment" → "Final Answer" → #8c564b
```

## Web App Architecture

### Tech Stack

- **Next.js 16.1.6** (App Router, Turbopack)
- **Tailwind CSS v4** + **Shadcn UI** (tabs, select, card, badge, tooltip, scroll-area, skeleton, separator)
- **D3.js** — scaleLinear, zoom, schemeTableau10 (for scatter plot & cluster colors)
- **Motion** (framer-motion) — trajectory pathLength animation
- **Zustand** — global state management
- **SWR** — data fetching with caching

### Project Structure

```
app/
  layout.tsx              → Root layout, wraps children in AppShell
  page.tsx                → Explorer page: t-SNE + case viewer + trace
  browser/page.tsx        → Cluster & taxonomy browser

components/
  layout/
    AppShell.tsx           → Header + tab nav (Explorer / Browser)
    Header.tsx             → Model selector, dataset selector
  tsne/
    TSNEPanel.tsx          → Container: color mode toggle, canvas, trajectory, tooltip, legend
    TSNECanvas.tsx         → Canvas2D scatter plot with D3 zoom, quadtree hit testing
    TrajectoryOverlay.tsx  → SVG overlay, Motion pathLength animation
    TSNETooltip.tsx        → Hover tooltip (taxonomy/cluster info + sentence)
    TSNELegend.tsx         → Color legend for taxonomy or cluster mode
  case/
    CasePanel.tsx          → Case prompt display + CaseSwitcher dropdown
    CaseSwitcher.tsx       → Select dropdown listing all cases
  trace/
    TracePanel.tsx         → Container: diagnosis bar + stats + distribution + sentences
    DiagnosisBar.tsx       → Predicted dx, gold dx, correct/incorrect badge
    TraceStats.tsx         → Sentence count
    TaxonomyDistribution.tsx → Stacked horizontal bar of taxonomy counts
    SentenceList.tsx       → ScrollArea of SentenceItems
    SentenceItem.tsx       → Single sentence with taxonomy color bar + hover
  browser/
    BrowserPanel.tsx       → Tabs for taxonomy list and cluster list
    TaxonomyCard.tsx       → Single taxonomy category card
    ClusterCard.tsx        → Single SAE cluster card with title + description
  ui/                      → Shadcn auto-generated components

hooks/
  useMetadata.ts           → SWR immutable fetch for metadata.json
  useCases.ts              → SWR fetch for cases/{model}_{dataset}.json
  useTSNE.ts               → SWR fetch for tsne/{model}.json
  useAppState.ts           → Zustand store

lib/
  types.ts                 → TypeScript interfaces (Metadata, Case, Sentence, TSNEPoint, etc.)
  constants.ts             → DEFAULT_MODEL, DEFAULT_DATASET, TAXONOMY_COLORS, NO_DATA_COLOR
  tsne-renderer.ts         → Pure Canvas2D render function (3-pass: background, active case, hovered)
  quadtree.ts              → findNearestPointLinear() for hover hit testing
  utils.ts                 → Shadcn cn() utility
```

### State Management (Zustand store)

```
selectedModel: string          — current model slug
selectedDataset: string        — current dataset slug
selectedCaseIndex: number      — index into loaded cases array
colorMode: "taxonomy" | "cluster"
hoveredPointIndex: number | null     — index into t-SNE points array
hoveredSentenceIndex: number | null  — index into current case's sentences
trajectoryProgress: number
trajectoryPlaying: boolean
```

Actions: `setModel`, `setDataset`, `setCaseIndex`, `setColorMode`, `setHoveredPoint`, `setHoveredSentence`, `navigateToCase` (resets hover + triggers trajectory play).

### Data Loading Strategy

1. `metadata.json` loaded once at startup (SWR immutable)
2. `cases/{model}_{dataset}.json` loaded on-demand when model/dataset changes
3. `tsne/{model}.json` loaded only when model has activations AND dataset has t-SNE
4. SWR caches previous loads — switching back to a previously viewed model is instant

### Canvas Rendering Details

- **3-pass rendering**: (1) background points (r=2, alpha=0.35), (2) active case points (r=4, alpha=0.9, thin stroke), (3) hovered point (r=6, full opacity, thick stroke)
- **Color**: taxonomy mode uses `metadata.taxonomy[idx].color`; cluster mode uses `d3.schemeTableau10[idx % 10]`
- **Hit testing**: `findNearestPointLinear()` iterates all points (sufficient for <12K points), finds nearest within 15px radius in data space
- **Zoom**: `d3.zoom()` with scaleExtent [0.5, 20], transform applied to all coordinates
- **DPR-aware**: canvas dimensions multiplied by `devicePixelRatio` for crisp rendering

### Trajectory Animation

- SVG `<path>` overlay on top of canvas, same dimensions
- Path `d` computed from current case's sentences with valid x/y, mapped through D3 scales + zoom transform
- Full path drawn faintly (opacity 0.1), animated path drawn via Motion `pathLength` (0→1, 2s, easeInOut)
- Hovering a sentence in the trace snaps `pathLength` to that sentence's fractional position
- Leading dot indicator at the current trajectory position
- Auto-plays when `navigateToCase()` is called (sets `trajectoryPlaying: true`)

### Bidirectional Hover Sync

- **Trace → Canvas**: hovering a SentenceItem sets `hoveredSentenceIndex` in store; TSNECanvas finds the matching point by scanning for `points[i][4] === activeCaseIdx && points[i][5] === hoveredSentenceIdx`; redraws with that point highlighted
- **Canvas → Trace**: hovering a canvas point sets `hoveredPointIndex`; the point's `[caseIdx, sentIdx]` can be read from the tuple; SentenceList scrolls the matching sentence into view
- **Canvas → Trajectory**: TrajectoryOverlay reads `hoveredSentenceIndex` and snaps pathLength

### Edge Cases Handled

- Models without activations (Claude, Grok): `hasTSNE = false`, t-SNE panel hidden, case+trace fills full width
- Non-MedQA datasets: `has_tsne = false` in metadata, same behavior
- Sentences with `t = -1` (unknown taxonomy): rendered with `NO_DATA_COLOR` (#94a3b8)
- Empty cluster data: browser shows "No cluster data available" message
- Loading states: Skeleton components while data fetches

## What's Not Yet Built / Known Gaps

- No Playwright tests yet
- URL state sync (sharing links with `?model=...&dataset=...&case=...`) not implemented
- Some models have very few strict-matched cases (gpt-oss-20b: 3, qwq-32b: 7) — their t-SNE plots are sparse
- Only MedQA has activation data; infrastructure exists for other datasets when activations become available
- No dark mode theming beyond Shadcn defaults
- The `original_sequence_idx` field maps sentences to SAE cluster IDs, but the cluster IDs in the exported data may not perfectly align with the SAE metadata `completeness_responses` (which only contains ~200 sampled sentences per model, not all sentences)
