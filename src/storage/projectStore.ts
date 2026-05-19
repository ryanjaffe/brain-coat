import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type {
  BriefValidated,
  CuratedIdea,
  Domain,
  InputBank,
  IterationMeta,
  ProjectConfig,
  RawIdea,
  ReferenceText,
  ScoredIdea,
} from "@shared/types";

/**
 * Filesystem layout mirrors Open Collider's schema:
 *
 *   projects/<name>/
 *     brief_validated.json
 *     input_bank.yaml
 *     project_config.yaml
 *     prompts/{idea_generation.md, judge.md}
 *     texts/T01.txt ...
 *     brainstorms/brainstorm_001/
 *       REPORT.md
 *       iter_001/
 *         domains/domain_bank.json
 *         raw_ideas.json
 *         scored_ideas.json
 *         curated_ideas.json
 *         iteration_meta.json
 */
export class ProjectStore {
  constructor(public readonly rootDir: string) {}

  projectDir(name: string) {
    return path.join(this.rootDir, name);
  }

  ensureProject(name: string) {
    const p = this.projectDir(name);
    fs.mkdirSync(path.join(p, "prompts"), { recursive: true });
    fs.mkdirSync(path.join(p, "texts"), { recursive: true });
    fs.mkdirSync(path.join(p, "brainstorms"), { recursive: true });
    return p;
  }

  writeBrief(name: string, brief: BriefValidated) {
    fs.writeFileSync(
      path.join(this.projectDir(name), "brief_validated.json"),
      JSON.stringify(brief, null, 2),
    );
  }

  readBrief(name: string): BriefValidated | null {
    const p = path.join(this.projectDir(name), "brief_validated.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  writeInputBank(name: string, bank: InputBank) {
    fs.writeFileSync(
      path.join(this.projectDir(name), "input_bank.yaml"),
      yaml.dump({
        forbidden_topics: bank.forbidden_topics,
        reference_texts: bank.reference_texts.map((t) => ({
          id: t.id,
          label: t.label,
          description: t.description ?? "",
        })),
      }),
    );
    for (const t of bank.reference_texts) {
      fs.writeFileSync(path.join(this.projectDir(name), "texts", `${t.id}.txt`), t.content);
    }
  }

  readInputBank(name: string): InputBank | null {
    const p = path.join(this.projectDir(name), "input_bank.yaml");
    if (!fs.existsSync(p)) return null;
    const parsed = yaml.load(fs.readFileSync(p, "utf8")) as {
      forbidden_topics: string[];
      reference_texts: Array<{ id: string; label: string; description?: string }>;
    };
    const reference_texts: ReferenceText[] = parsed.reference_texts.map((t) => ({
      ...t,
      content: fs.readFileSync(path.join(this.projectDir(name), "texts", `${t.id}.txt`), "utf8"),
    }));
    return { forbidden_topics: parsed.forbidden_topics ?? [], reference_texts };
  }

  writeConfig(name: string, cfg: ProjectConfig) {
    fs.writeFileSync(path.join(this.projectDir(name), "project_config.yaml"), yaml.dump(cfg));
  }

  readConfig(name: string): ProjectConfig | null {
    const p = path.join(this.projectDir(name), "project_config.yaml");
    if (!fs.existsSync(p)) return null;
    return yaml.load(fs.readFileSync(p, "utf8")) as ProjectConfig;
  }

  listProjects(): string[] {
    if (!fs.existsSync(this.rootDir)) return [];
    return fs
      .readdirSync(this.rootDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  // ----- brainstorm / iteration helpers -----

  brainstormDir(name: string, brainstormId: number): string {
    return path.join(
      this.projectDir(name),
      "brainstorms",
      `brainstorm_${String(brainstormId).padStart(3, "0")}`,
    );
  }

  iterDir(name: string, brainstormId: number, iter: number): string {
    return path.join(this.brainstormDir(name, brainstormId), `iter_${String(iter).padStart(3, "0")}`);
  }

  ensureIter(name: string, brainstormId: number, iter: number): string {
    const dir = this.iterDir(name, brainstormId, iter);
    fs.mkdirSync(path.join(dir, "domains"), { recursive: true });
    return dir;
  }

  writeDomains(name: string, brainstormId: number, iter: number, domains: Domain[]) {
    const dir = this.ensureIter(name, brainstormId, iter);
    fs.writeFileSync(path.join(dir, "domains", "domain_bank.json"), JSON.stringify(domains, null, 2));
  }

  writeRawIdeas(name: string, brainstormId: number, iter: number, ideas: RawIdea[]) {
    fs.writeFileSync(
      path.join(this.iterDir(name, brainstormId, iter), "raw_ideas.json"),
      JSON.stringify(ideas, null, 2),
    );
  }

  writeScored(name: string, brainstormId: number, iter: number, scored: ScoredIdea[]) {
    fs.writeFileSync(
      path.join(this.iterDir(name, brainstormId, iter), "scored_ideas.json"),
      JSON.stringify(scored, null, 2),
    );
  }

  writeCurated(name: string, brainstormId: number, iter: number, curated: CuratedIdea[]) {
    fs.writeFileSync(
      path.join(this.iterDir(name, brainstormId, iter), "curated_ideas.json"),
      JSON.stringify(curated, null, 2),
    );
  }

  readCurated(name: string, brainstormId: number, iter: number): CuratedIdea[] | null {
    const p = path.join(this.iterDir(name, brainstormId, iter), "curated_ideas.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  writeIterMeta(name: string, brainstormId: number, iter: number, meta: IterationMeta) {
    fs.writeFileSync(
      path.join(this.iterDir(name, brainstormId, iter), "iteration_meta.json"),
      JSON.stringify(meta, null, 2),
    );
  }

  writeReport(name: string, brainstormId: number, markdown: string) {
    const dir = this.brainstormDir(name, brainstormId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "REPORT.md"), markdown);
  }

  // Default prompts — user can edit in the prompt editor.
  ensureDefaultPrompts(name: string) {
    const dir = path.join(this.projectDir(name), "prompts");
    const idea = path.join(dir, "idea_generation.md");
    const judge = path.join(dir, "judge.md");
    if (!fs.existsSync(idea)) fs.writeFileSync(idea, DEFAULT_IDEA_PROMPT);
    if (!fs.existsSync(judge)) fs.writeFileSync(judge, DEFAULT_JUDGE_PROMPT);
  }

  readPrompt(name: string, file: "idea_generation.md" | "judge.md"): string {
    return fs.readFileSync(path.join(this.projectDir(name), "prompts", file), "utf8");
  }

  writePrompt(name: string, file: "idea_generation.md" | "judge.md", content: string) {
    fs.writeFileSync(path.join(this.projectDir(name), "prompts", file), content);
  }

  nextBrainstormId(name: string): number {
    const dir = path.join(this.projectDir(name), "brainstorms");
    if (!fs.existsSync(dir)) return 1;
    const ids = fs
      .readdirSync(dir)
      .map((n) => parseInt(n.replace("brainstorm_", ""), 10))
      .filter((n) => Number.isFinite(n));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }
}

export const DEFAULT_IDEA_PROMPT = `You are a semantic collision engine. You will be given:
- A problem brief
- A reference text (context about the domain)
- A distant-domain active principle

Your task: generate exactly {N} ideas that could ONLY exist through the collision of the reference context with the active principle.

Rules:
- Each idea must be mechanistically grounded in the distant domain
- Each idea must be directly applicable to the brief
- No obvious metaphors — real structural transfers only
- Ideas should be 2–4 sentences: mechanism + application

Output a JSON array of strings.`;

export const DEFAULT_JUDGE_PROMPT = `You are an idea evaluator. Score 0..1 on each axis. Be calibrated: 0.5 is average, 0.9+ is exceptional.`;
