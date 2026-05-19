# Brain Coat

Desktop reimplementation of the **Open Collider** semantic collision pipeline,
powered by **xAI Grok** (`grok-4-3`). Built with Electron + React + TypeScript.

The full pipeline runs locally:

```
Setup → Domain Generation → Idea Generation → Scoring → Curation → Feedback → (next iteration)
```

Projects on disk are schema-compatible with the original Open Collider CLI.

## Quick start

```bash
npm install
npm run dev:electron     # launches Vite + Electron
```

On first launch you'll be asked for your `XAI_API_KEY`. It's stored encrypted
via Electron's `safeStorage` in your OS keychain — never written to disk in
plaintext.

## Headless CLI

The four pipeline modules are pure TypeScript and run without Electron:

```bash
XAI_API_KEY=xai-... npm run cli -- ./projects my_brainstorm
```

This reads `projects/my_brainstorm/{brief_validated.json, input_bank.yaml, project_config.yaml}`
and runs one iteration end-to-end, writing checkpoints after every stage.

## Project layout on disk

```
projects/<name>/
├── brief_validated.json
├── input_bank.yaml
├── project_config.yaml          # llm_backend: "grok-4-3"
├── prompts/{idea_generation.md, judge.md}
├── texts/T01.txt …
└── brainstorms/brainstorm_001/
    ├── REPORT.md
    └── iter_001/
        ├── domains/domain_bank.json
        ├── raw_ideas.json
        ├── scored_ideas.json
        ├── curated_ideas.json
        └── iteration_meta.json
```

Projects created here can be opened by the original Open Collider CLI, and
vice versa.

## Pipeline modules

Importable headlessly from `src/pipeline/`:

- `domainGenerator.generateDomains` — temperature **0.95**, generates 8–12 distant domains.
- `ideaEngine.generateIdeas` — temperature **0.92**, parallel `(text × domain)` collisions, configurable concurrency.
- `scorer.scoreIdeas` — temperature **0.2**, batched parallel scoring on the user's axes.
- `curator.curateIdeas` — temperature **0.4**, picks 10–20 gems from the top shortlist.
- `strategies.planNextIteration` — Fresh / Deepen / Refresh weights for the next run.
- `runIteration` — full pipeline with checkpointing after each stage.

All Grok calls retry 3× with exponential backoff (2s / 4s / 8s). Per-call
failures are recorded as `status: "failed"` rather than aborting the batch.

## Scripts

- `npm run dev:electron` — Vite + Electron in dev
- `npm run build` — build renderer + main
- `npm run package` — produce a distributable via electron-builder
- `npm run typecheck` — type-check both processes
- `npm run cli` — headless single-iteration run

## Settings

- Concurrency (1–8) and temperatures per stage are stored in `project_config.yaml`.
- API key rotation: Settings → API key → Save & test.
- Projects folder: Projects → Change folder.

## Keyboard shortcuts (Curation)

- `L` — Love
- `K` — Like
- `T` — Trash

## Out of scope

No Anthropic API calls, no Skill mode, no cloud sync, no web build.
