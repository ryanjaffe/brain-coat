import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { DEFAULT_IDEA_PROMPT, DEFAULT_JUDGE_PROMPT } from "../../shared/prompts";

type FileName = "idea_generation.md" | "judge.md";

const DEFAULTS: Record<FileName, string> = {
  "idea_generation.md": DEFAULT_IDEA_PROMPT,
  "judge.md": DEFAULT_JUDGE_PROMPT,
};

const DESCRIPTIONS: Record<FileName, string> = {
  "idea_generation.md": "Controls how ideas are generated from each text × knowledge probe collision. Use {N} for the idea count.",
  "judge.md": "Controls how ideas are scored. Referenced at scoring time.",
};

export function PromptEditor() {
  const { currentProject, rootDir } = useStore();
  const [file, setFile] = useState<FileName>("idea_generation.md");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    setSaved(false);
    api.prompt.read({ rootDir, name: currentProject, file }).then((c) => setContent(c as string));
  }, [currentProject, rootDir, file]);

  async function save() {
    if (!currentProject) return;
    await api.prompt.write({ rootDir, name: currentProject, file, content });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetToDefault() {
    setContent(DEFAULTS[file]);
    setSaved(false);
  }

  if (!currentProject) {
    return <div className="mx-auto max-w-3xl p-8 text-slate-400">Open a project first.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Edit prompts</h1>
      <p className="mb-4 text-xs text-slate-500">
        These prompts are saved per-project and loaded at runtime. Changes affect all future runs.
      </p>

      <div className="mb-3 flex gap-2">
        {(["idea_generation.md", "judge.md"] as FileName[]).map((f) => (
          <button
            key={f}
            className={`btn-ghost ${file === f ? "bg-slate-800 text-slate-200" : ""}`}
            onClick={() => setFile(f)}
          >
            {f === "idea_generation.md" ? "Idea generation" : "Scoring judge"}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs text-slate-500">{DESCRIPTIONS[file]}</p>

      <textarea
        className="input h-80 font-mono text-xs leading-relaxed"
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        spellCheck={false}
      />

      <div className="mt-3 flex items-center gap-3">
        <button className="btn" onClick={save}>Save</button>
        <button className="btn-ghost" onClick={resetToDefault}>Reset to default</button>
        {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
      </div>
    </div>
  );
}
