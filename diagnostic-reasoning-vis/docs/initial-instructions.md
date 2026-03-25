# Project Briefing

We have just finished work on a project that takes reasoning traces from models on clinical diagnostic vignette cases and extracts sentence level activations from inside the model, and clusters them using an SAE. These clusters are then assigned to a universal taxonomy. Importantly, the activations from each model are going to differ because of the different hidden dimensions they contain.

As part of our work I want to visualise this on an interactive NextJS website.

1. An interactive tSNE plot is shown of all the internal activations for a given model. Please provide a way to switch between models. When there is a model switch, just show a random medical case that exists for that model.
   - Each point represents an individual sentence in tSNE space.
   - There should be two modes, cluster assignment and universal taxonomy assignment
   - Depending on the mode, hovering over a sentence reveals the cluster number, cluster title, cluster description and the sentence, OR taxonomy title, taxonomy description and the sentence.
   - Clicking on a point switches the subsequent medical case and reasoning trace to the corresponding trace the sentence is from.

2. A medical case is shown. Please provide a way to switch between medical cases.
3. The reasoning trace is shown with each sentence highlighted by the universal taxonomy colour. It also show in a panel the model diagnosis, the gold correct diagnosis, and an indicator showing where the model was correct or incorrect. There should also be a panel with a counter of the length of sentences and a stacked bar plot showing the split of each universal taxonomy sentence type. Whenever a case is loaded, I wanted you to show an animation of the trajectory of the reasoning trace. Since each sentence has a point in the tSNE, I want a line that starts at the first activation and jumps to the next activation to the next so on and so forth finishing with the last sentence activation. When you hover over a sentence, it should move the animated trajectory back to the corresponding point in the tSNE.
4. A separate tab should allow browsing of clusters and the universal taxonomy.

## Taxonomies & Models

We have standard names that were used in the files. They can be found here.

```python

states = {0: 'Orchestration / meta-control',
 1: 'Case evidence extraction (patient-specific facts)',
 2: 'Evidence processing (salience + interpretation + summarization)',
 3: 'Medical knowledge / templates / criteria (general facts)',
 4: 'Hypothesis generation (differential expansion)',
 5: 'Hypothesis evaluation & narrowing (support OR exclude)',
 6: 'Final answer commitment'}

clean_taxonomy_names <- c(
  "Orchestration / meta-control": "Orchestration",
  "Case evidence extraction (patient-specific facts)": "Case Evidence Extraction",
  "Evidence processing (salience + interpretation + summarization)": "Evidence Processing",
  "Medical knowledge / templates / criteria (general facts)": "Recalling Medical Knowledge",
  "Hypothesis generation (differential expansion)": "Hypothesis Generation",
  "Hypothesis evaluation & narrowing (support OR exclude)": "Hypothesis Evaluation",
  "Final answer commitment": "Final Answer"
)

clean_model_names = {
    "deepseek-r1-distill-llama-8b": "Llama 8B (DSR1)",
    "deepseek-r1-distill-qwen-1.5b": "Qwen 1.5B (DSR1)",
    "deepseek-r1-distill-qwen-14b": "Qwen 14B (DSR1)",
    "gpt-oss-20b": "GPT OSS 20B",
    "huatuogpt-o1-8b": "HuatuoGPT O1 8B",
    "qwq-32b": "QWQ 32B",
    "grok-3-mini": "Grok 3 Mini",
    "claude-3-7-sonnet-20250219": "Claude 3.5 Sonnet",
}

clean_dataset_names = {
    "nejm-cpc": "NEJM CPC",
    "medqa": "MedQA",
    "medmcqa-filtered": "MedMCQA",
}

```

## Important Files

The primary folder where all my material is lies here `~/Documents/GitHub-Projects/bmj-cot-ai/`

- `~/Documents/GitHub-Projects/bmj-cot-ai/activations`
- `~/Documents/GitHub-Projects/bmj-cot-ai/figure_data/white_box_edited`
  - This is where you can find important files about the sentence annotations by universal taxonomy and by cluster.
  - `results.labeled.json` and `{dataset}_with_second_responses` are two useful files
- You can see the code I used to load all these files in. We can think about how best to do this, but it may be appropriate to actually preprocess the data and export it as a JSON to use for this web app.
- Feel free to use scribe MCP to create a notebook in my `~/Documents/GitHub-Projects/bmj-cot-ai/notebooks` and do the pre-processing you need.

## Important Notes

- Build to allow for multiple datasets
- I have a particular colour palette I want you to follow with the universal taxonomy.
- The data is messy and every model will have different corresponding cases.
- During my static visualisation for my paper, I wrote some code in Python to do a similar visualisation which you can view below. You shouldn't copy it but it helps you understand the structure of the files. You should still explore the files yourself.
- I currently do not have activations for any other dataset than MedQA however I want you to build out infrastructure to account for when we do.
- The activation files only have the sentences but they may not necessarily exactly match the sentences in `results.labeled.json` so we will probably have to drop any cases where not all the sentences in the reasoning trace have a matching activation.

```python
color_map = {
    'Orchestration / meta-control': '#9467bd',
    'Case evidence extraction (patient-specific facts)': '#ff7f0e',
    'Evidence processing (salience + interpretation + summarization)': '#1f77b4',
    'Medical knowledge / templates / criteria (general facts)': '#d62728',
    'Hypothesis generation (differential expansion)': '#e377c2',
    'Hypothesis evaluation & narrowing (support OR exclude)': '#2ca02c',
    'Final answer commitment': '#8c564b',
}
```

```python
# Known issue where some answers don't have pmcid

def get_dupes(model):
    print(f"Finding dupes for {model}")
    dupe_pmcids=[]
    case_prompts = []
    lstrip_text = "Read the following case presentation and give the most likely diagnosis.\nFirst, provide your internal reasoning for the diagnosis within the tags <think> ... </think>.\nThen, output the final diagnosis (just the name of the disease/entity) within the tags <answer> ... </answer>.\n\n----------------------------------------\nCASE PRESENTATION\n----------------------------------------\n"
    rstrip_text = " \n\n----------------------------------------\nOUTPUT TEMPLATE\n----------------------------------------\n<think>\n...your internal reasoning for the diagnosis...\n</think><answer>\n...the name of the disease/entity...\n</answer>"

    if model in ["claude-3-7-sonnet-20250219", "grok-3-mini"]:
        path = f"figure_data/black_box_edited/"
    else:
        path = f"figure_data/white_box_edited/"

    with open(os.path.join(path, model, "medmcqa-filtered_with_second_responses", f"responses_{model}.graded.json"), 'r') as file:
        data = json.load(file)
        for trace in data:
            try:
                case_prompt = {
                    "question_id": trace['question_id'],
                    "question": trace['question'],
                    "pmcid": trace['pmcid']
                }
            except:
                pass
            case_prompts.append(case_prompt)

    case_prompts = pd.DataFrame(case_prompts)
    dupes = case_prompts.duplicated(subset = ["pmcid"], keep = False) | case_prompts.duplicated(subset = ["question"], keep = False)


    dupe_pmcids = case_prompts[dupes]["question_id"].tolist()

    # So issue is when there are duplicate case prompts but the pmcid is been changed in the other results.labeled.json
    dupe_diagnoses = []
    avail_ids = []
    dupe_diagnoses = case_prompts[case_prompts.duplicated(subset = ["question"], keep = False)]["question"].tolist()
    avail_ids = case_prompts[~case_prompts.duplicated(subset = ["question"], keep = False)]["question_id"].tolist()
    dupe_diagnoses = [l.removeprefix(lstrip_text).removesuffix(rstrip_text) for l in dupe_diagnoses]


    # Finding PMIDs that have duplicate case prompts
    case_prompts = []
    duplicate_case_prompts = []
    with open(os.path.join(path, model, "medmcqa-filtered_with_second_responses", "results.labeled.json"), 'r') as file:
        data = json.load(file)
        for trace in data['traces']:
            case_prompt = {
                "case_prompt": trace['case_prompt'],
                "question_id": trace['question_id']
            }
            case_prompts.append(case_prompt)
    case_prompts = pd.DataFrame(case_prompts)
    dupes = (case_prompts.duplicated(subset = ["case_prompt"])) | (case_prompts['case_prompt'].isin(dupe_diagnoses))


    dupe_pmcids.extend(case_prompts[dupes]["question_id"].tolist())




    return dupe_pmcids, dupe_diagnoses, avail_ids


def get_data(dataset, models):
    data = {}
    answers = {}

    # Retrieve answers and traces for each model
    for model in models:
        if model in ["claude-3-7-sonnet-20250219", "grok-3-mini"]:
            path = f"figure_data/black_box_edited/"
        else:
            path = f"figure_data/white_box_edited/"
        if dataset == "medmcqa-filtered":
            dupe_pmcids, dupe_diagnoses, avail_ids = get_dupes(model)
            print(dupe_pmcids)
        with open(os.path.join(path, model, f"{dataset}_with_second_responses", "results.labeled.json"), 'r') as file:
            trace = json.load(file)
            # medmcqa-filtered unfortunately had some duplicate questions in the original benchmark
            if dataset == "medmcqa-filtered":
                trace["traces"] = [t for t in trace["traces"] if ((t["question_id"] not in dupe_pmcids) and (t["pmcid"] != "") and (t["question_id"] in avail_ids))]
            data[model] = trace

    # Retrieve graded responses for each model
    for model in models:
        if model in ["claude-3-7-sonnet-20250219", "grok-3-mini"]:
            path = f"figure_data/black_box_edited/"
        else:
            path = f"figure_data/white_box_edited/"
        if dataset == "medmcqa-filtered":
            dupe_pmcids, dupe_diagnoses, avail_ids = get_dupes(model)
        with open(os.path.join(path, model, f"{dataset}_with_second_responses", f"responses_{model}.graded.json"), 'r') as file:
            answers_obj = json.load(file)
            if dataset == "medmcqa-filtered":
                answers_obj = [a for a in answers_obj if (a.get("question_id") and a["question_id"] not in dupe_pmcids)]
            answers[model] = answers_obj

    # Enter graded responses
    for model in models:
        print(f"Fixing graded responses in {model}")
        is_correct_by_pmcid = {
            str(a["question_id"]): bool(a["is_correct"]) for a in answers[model] if a.get("question_id") is not None
        }
        # medmcqa-filtered has a different format for pmcid and matches based on question_id in results.labeled.json to graded.json
        if dataset == "medmcqa-filtered":
            for trace in data[model]['traces']:
                a = is_correct_by_pmcid[trace['question_id']]
                trace['verified_correct'] = a
        else:
            for trace in data[model]['traces']:
                a = is_correct_by_pmcid[str(trace['question_id'])]
                trace['verified_correct'] = a
    return data, answers

analysis = "white_box_edited"

models = ["claude-3-7-sonnet-20250219", "grok-3-mini", "deepseek-r1-distill-llama-8b", "deepseek-r1-distill-qwen-1.5b", "deepseek-r1-distill-qwen-14b", "gpt-oss-20b", "huatuogpt-o1-8b", "qwq-32b"]

all_data = {}
for dataset in ["medqa", "medmcqa-filtered", "nejm-cpc"]:
    data, answers = get_data(dataset, models)
    all_data[dataset] = data
```

```python
import pickle, numpy as np, pandas as pd, os, re
from sklearn.manifold import TSNE

ACT_FILES = {
    re.match(r'activations_(.+?)_\d+_(\d+)\.pkl', f).group(1): f
    for f in os.listdir('activations') if f.endswith('.pkl') and re.match(r'activations_(.+?)_\d+_(\d+)\.pkl', f)
}

def load_activations_tsne(model_name, all_data, frac=0.1, perplexity=30, seed=2026):
    """Load activations, match to cluster/taxonomy labels, sample, and compute t-SNE."""
    fname = ACT_FILES[model_name]
    layer = re.search(r'_(\d+)\.pkl$', fname).group(1)
    activations, act_sentences, _ = pickle.load(open(f'activations/{fname}', 'rb'))

    # Build sentence -> label lookup
    sent_to_info = {}
    for trace in all_data['medqa'][model_name]['traces']:
        for sent_idx, item in trace['label_json'].items():
            s = item['sentence']
            if s not in sent_to_info:
                seq_pos = int(sent_idx) - 1
                orig_cluster = trace['original_sequence_idx'][seq_pos] if seq_pos < len(trace['original_sequence_idx']) else 'N/A'
                sent_to_info[s] = {'cluster_idx': orig_cluster, 'universal_label': item['function']}

    rows = [{'idx': i, **sent_to_info[s]} for i, s in enumerate(act_sentences) if s in sent_to_info]
    df = pd.DataFrame(rows).sample(frac=frac, random_state=seed).reset_index(drop=True)
    act_sub = activations[df['idx'].values]

    coords = TSNE(n_components=2, random_state=seed, perplexity=perplexity).fit_transform(act_sub)

    df['tsne_x'] = coords[:, 0]
    df['tsne_y'] = coords[:, 1]
    df['sentence'] = [act_sentences[i] for i in df['idx']]
    df['sentence_short'] = df['sentence'].str[:120] + '...'
    df['model'] = model_name
    df['layer'] = layer
    return df

print(f"Available models: {list(ACT_FILES.keys())}")
print("Function defined: load_activations_tsne()")


import matplotlib.pyplot as plt
import math

color_map = {
    'Orchestration / meta-control': '#9467bd',
    'Case evidence extraction (patient-specific facts)': '#ff7f0e',
    'Evidence processing (salience + interpretation + summarization)': '#1f77b4',
    'Medical knowledge / templates / criteria (general facts)': '#d62728',
    'Hypothesis generation (differential expansion)': '#e377c2',
    'Hypothesis evaluation & narrowing (support OR exclude)': '#2ca02c',
    'Final answer commitment': '#8c564b',
}

models = sorted(df_all['model'].unique())
n_models = len(models)
n_rows = 2
n_cols = math.ceil(n_models / n_rows)

fig, axes = plt.subplots(n_rows, n_cols, figsize=(5*n_cols, 5*n_rows), dpi=120)
axes = axes.flatten()  # make indexing simple

for ax, model in zip(axes, models):
    mdf = df_all[df_all['model'] == model]
    layer = mdf['layer'].iloc[0]

    for label, color in color_map.items():
        subset = mdf[mdf['universal_label'] == label]
        ax.scatter(
            subset['tsne_x'],
            subset['tsne_y'],
            c=color,
            s=10,
            alpha=0.5,
            label=label
        )

    ax.set_title(f'{clean_model_names[model]}\n(Layer {layer})', fontsize=15)
    ax.set_xticks([])
    ax.set_yticks([])

# turn off unused axes
for ax in axes[len(models):]:
    ax.axis("off")

handles, labels = axes[0].get_legend_handles_labels()
short_labels = [l[:35] + '...' if len(l) > 35 else l for l in labels]
fig.legend(handles, short_labels, loc='lower center', ncol=4, fontsize=7, markerscale=3, bbox_to_anchor=(0.5, -0.08))
fig.suptitle('t-SNE of Internal Activations — Coloured by Universal Taxonomy', fontsize=13, y=1.02)
plt.tight_layout()
plt.savefig('tsne_activations_by_taxonomy.png', dpi=300, bbox_inches='tight')
plt.show()

```

## Stack & Libraries

- Let's use NextJS
- Let's use Shadcn UI for basic elements
  - You should never manually write shadcn elements but rather use shadcn MCP to add components that you need
- Let's use Playwright MCP for testing
- Let's use Motion for the animation that we need.
- I want you to use D3 JS for the chart
- Deployment should be done on Vercel via MCP
