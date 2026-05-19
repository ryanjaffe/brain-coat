# AGENTS.md — Open Collider Desktop (Grok)

This document tells AI coding agents how to work on this codebase. Read it in full before touching any file.

---

## What this project is

A cross-platform desktop application (Electron + React + TypeScript) that implements the [Open Collider](https://github.com/CL-ML/open-collider) semantic collision pipeline as a standalone GUI, powered by the **xAI Grok API (`grok-4-3` model)**. The pipeline operationalizes Koestler's bisociation theory: it injects structurally distant knowledge domains into a prompt to force collisions that escape the LLM's default-output basin.

The four pipeline stages — Domain Generation → Idea Generation → Scoring → Curation — are the heart of the codebase. Everything else (UI, storage, settings) exists to serve them.

---

## Repository layout

```
open-collider-desktop/
├── electron/                  # Electron main process only
│   ├── main.ts                # app bootstrap, window creation
│   ├── ipc/                   # IPC handlers (file I/O, keychain, pipeline runner)
│   └── preload.ts             # contextBridge surface exposed to renderer
├── src/
│   ├── app/                   # React renderer (never touches Node APIs directly)
│   │   ├── views/             # one file per top-level screen
│   │   └── components/        # shared UI primitives
│   ├── pipeline/              # pure TS — all LLM orchestration, no UI imports
│   │   ├── domainGenerator.ts
│   │   ├── ideaEngine.ts
│   │   ├── scorer.ts
│   │   ├── curator.ts
│   │   └── strategies.ts      # Fresh / Deepen / Refresh logic
│   └── storage/               # read/write project files; matches OC on-disk schema
├── projects/                  # default user data directory (user-configurable)
├── prompts/                   # default prompt templates (idea_generation.md, judge.md)
├── tests/
└── AGENTS.md                  # this file
```

**Rule:** `src/pipeline/` must never import from `src/app/`. The pipeline modules are pure orchestration and must be usable headlessly (e.g., from a CLI entry point or tests) without a renderer context.

---

## LLM backend

All LLM calls use the xAI Grok API via the OpenAI-compatible SDK:

```typescript
import OpenAI from "openai";

const grok = new OpenAI({
  apiKey: getKeyFromKeychain(), // never from process.env in production builds
  baseURL: "https://api.x.ai/v1",
});
```

**Model:** always `grok-4-3`. Never hardcode any other model string. If you need to reference the model, import the constant:

```typescript
import { GROK_MODEL } from "../pipeline/constants";
// GROK_MODEL = "grok-4-3"
```

**Temperature by stage:**

| Stage | Temperature | Reason |
|---|---|---|
| Domain generation | 0.95 | Maximize structural distance |
| Idea generation | 0.92 | High creative variance |
| Scoring | 0.2 | Deterministic judgments |
| Curation | 0.4 | Consistent filtering with slight flexibility |

Do not deviate from these defaults without updating this table and leaving a comment in the code.

---

## Pipeline stages — key invariants

### 1. Domain Generator (`pipeline/domainGenerator.ts`)

- Generates 8–12 structurally distant knowledge domains for a given brief.
- Each domain object must conform to `DomainSchema`:
  ```typescript
  type Domain = {
    id: string;           // "D01", "D02", …
    name: string;         // specific sub-discipline, never vague categories
    activePrinciple: string;   // the counter-intuitive mechanism from that domain
    bridgingQuestion: string;  // how this mechanism might apply to the brief
    strategy: "fresh" | "deepen" | "refresh";
    parentDomainId?: string;   // set for deepen/refresh variants
  };
  ```
- Must **exclude** domains already used in prior iterations (pass `usedFamilies: string[]`).
- Sequential call (one domain batch per iteration), not parallel.
- Persist output to `iter_N/domains/domain_bank.json` before returning.

### 2. Idea Engine (`pipeline/ideaEngine.ts`)

- For each `(referenceText × domain)` pair, issues one Grok call generating ~20 candidate ideas.
- **Concurrency cap: 4 simultaneous calls.** Use a semaphore/pool; do not use raw `Promise.all` on the full cross-product. The cap is configurable via `project_config.yaml → concurrency_limit`.
- Each idea object must conform to `IdeaSchema`:
  ```typescript
  type Idea = {
    id: string;           // "I_D03_T02_017" — domain, text, index
    text: string;
    domainId: string;
    textId: string;       // "T01", "T02", …
    status: "raw" | "scored" | "curated" | "loved" | "liked" | "trashed";
    scores?: Record<string, number>;  // keyed by axis name
    compositeScore?: number;
  };
  ```
- Emit a progress event after each completed call so the UI can update the counter.
- Persist all raw ideas to `iter_N/raw_ideas.json` incrementally (append, don't batch-write at the end — a crash mid-run should not lose completed calls).

### 3. Scorer (`pipeline/scorer.ts`)

- Batches ideas into groups of 20; runs 3 concurrent scoring calls.
- Scoring prompt uses axes and weights from `project_config.yaml → scoring_axes`.
- Output is a numeric score (0–10) per axis per idea plus a `compositeScore` (weighted average).
- Mutates `status` on each idea to `"scored"` and writes back to `iter_N/scored_ideas.json`.
- Must be idempotent: if called on a batch that already has scores, skip it rather than re-scoring.

### 4. Curator (`pipeline/curator.ts`)

- Two-phase filter:
  1. Hard threshold: drop ideas below `compositeScore < config.curationThreshold` (default 0.65).
  2. LLM curation call: from the remaining pool, select the true gems — ideas that are **both** relevant to the brief **and** genuinely non-trivial (mechanistic transfer, not decorative analogy). Target 10–20 curated ideas.
- Write curated ideas to `iter_N/curated_ideas.json`.
- The curation prompt must include the brief and several examples of what "non-trivial" means (drawn from `prompts/judge.md`).

### 5. Strategies (`pipeline/strategies.ts`)

After the user provides love/like/trash feedback on curated ideas, compute domain evolution weights for the next iteration:

- **Fresh:** always included; generates new domains, excluding all previously used families.
- **Deepen:** fires when ≥1 domain has a loved idea; generates 2–3 sub-specialties within those families.
- **Refresh:** fires when `(loved + liked) ≥ 3`; extracts causal mechanisms from top-rated ideas and finds new disciplines sharing the same structural pattern.

The function signature is:
```typescript
function computeNextIterationStrategy(
  feedback: IdeaFeedback[],
  history: IterationHistory
): StrategyPlan;
```

---

## Error handling and resilience

Every Grok API call must be wrapped in retry logic:

```typescript
// Use the utility in pipeline/retry.ts
const result = await withRetry(
  () => grok.chat.completions.create(...),
  { maxAttempts: 3, backoffMs: [2000, 4000, 8000] }
);
```

If a call fails after all retries:
- Mark that collision as `status: "failed"` in the JSON.
- Emit a warning event (do not throw; the batch must continue).
- Log the error with the domain ID and text ID so it's reproducible.
- **Never silently discard.** Failed collisions must appear in the final report under "skipped."

**Checkpointing:** write to disk after every completed pipeline stage. On startup, check for an incomplete `iter_N/` folder and offer resume.

---

## On-disk schema compatibility

The project folder structure must remain **byte-compatible** with the upstream Open Collider CLI. Do not rename fields. Do not add required fields without making them optional with defaults. The canonical schemas are in `storage/schemas/`.

When reading a project created by the upstream CLI tool, the app must handle missing optional fields gracefully (e.g., `concurrency_limit` might not exist in older projects — default to 4).

When writing `project_config.yaml`, always include `llm_backend: "grok-4-3"` so the upstream tool knows not to expect Anthropic API credentials.

---

## Security rules — non-negotiable

1. **API key storage:** use `electron-keytar` (or Electron's `safeStorage` AES-256 wrapper). Never write the key to any file, never log it, never include it in IPC messages. The key leaves the keychain only as the `Authorization` header value, assembled in the main process.

2. **No key in renderer:** the renderer process must never have access to the raw API key. The renderer calls an IPC handler (`pipeline:runStage`) and receives results; it never calls the Grok API directly.

3. **No `.env` in production:** `.env` files are for local development only. Production builds read from the keychain exclusively.

4. **Input sanitization:** user-supplied text (brief, reference texts, forbidden topics) must be passed through `sanitizeUserInput()` before insertion into any prompt string. This strips null bytes and enforces a 50,000-character cap per field.

---

## Prompt templates

Prompt text lives in `prompts/idea_generation.md` and `prompts/judge.md`. These files are user-editable at runtime via the built-in prompt editor.

- Load them fresh from disk at the start of each brainstorm session — never cache across sessions.
- Provide a "Reset to default" action that copies from `prompts/defaults/` (which is read-only, bundled with the app).
- Prompt files use `{{variable}}` interpolation (double-curly, no spaces). The interpolation function is in `pipeline/promptLoader.ts`. Do not invent a different syntax.

---

## Testing

- Unit tests live in `tests/unit/` and cover each pipeline module in isolation. Mock all Grok API calls with `vi.mock`.
- Integration tests live in `tests/integration/` and run against a local fixture project in `tests/fixtures/project_spotify/`.
- **Do not write tests that call the live Grok API.** If you need to add a test that requires a real response, add it to `tests/manual/` with a comment explaining why, and skip it in CI with `test.skip`.
- Run tests with `pnpm test`. All tests must pass before a PR is merged.

---

## Code style

- TypeScript strict mode (`"strict": true` in `tsconfig.json`). No `any` without a `// eslint-disable` comment explaining why.
- Functional style preferred in `src/pipeline/`. Classes are acceptable in `electron/` for stateful IPC handlers.
- All exported functions must have JSDoc comments — these pipeline modules are also a public API.
- Import order: Node built-ins → third-party → internal (enforced by ESLint).
- No default exports in `src/pipeline/`. Named exports only.

---

## What agents should NOT do

- Do not change the on-disk JSON/YAML field names or schema structure without a migration script.
- Do not add streaming UI logic inside `src/pipeline/`. Pipeline modules emit typed events; the UI subscribes. Keep these concerns separated.
- Do not increase the concurrency cap above 8 without a comment explaining why and updating the settings UI bounds.
- Do not swap `grok-4-3` for another model without a project-level decision — this is a deliberate product choice, not a dev preference.
- Do not add any calls to the Anthropic API. This project uses Grok exclusively.
- Do not use `localStorage` or `sessionStorage`. All persistence goes through the main process via IPC.

---

## Where to start for common tasks

| Task | Start here |
|---|---|
| Change how domains are generated | `pipeline/domainGenerator.ts` → prompt in `prompts/idea_generation.md` |
| Add a new scoring axis | `storage/schemas/projectConfig.ts` + `pipeline/scorer.ts` + `ProjectSetup.tsx` |
| Change concurrency behavior | `pipeline/ideaEngine.ts` → `Semaphore` class |
| Fix a crash on resume | `electron/ipc/checkpointHandler.ts` |
| Add a new view | `src/app/views/` + register route in `App.tsx` |
| Modify the report format | `pipeline/reportGenerator.ts` + `views/Report.tsx` |
| Change retry logic | `pipeline/retry.ts` |
