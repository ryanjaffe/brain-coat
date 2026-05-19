import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

type FileName = "idea_generation.md" | "judge.md";

const DEFAULTS: Record<FileName, string> = {
  "idea_generation.md": `You are a semantic collision engine. ... (default)`,
  "judge.md": `You are an idea evaluator. ... (default)`,
};

export function PromptEditor() {
  const { currentProject, rootDir } = useStore();
  const [file, setFile] = useState<FileName>("idea_generation.md");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!currentProject) return;
    api.prompt.read({ rootDir, name: currentProject, file }).then((c) => setContent(c as string));
  }, [currentProject, rootDir, file]);

  async function save() {
    if (!currentProject) return;
    await api.prompt.write({ rootDir, name: currentProject, file, content });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Prompts</h1>
      <div className="mb-3 flex gap-2">
        {(["idea_generation.md", "judge.md"] as FileName[]).map((f) => (
          <button key={f} className={`btn-ghost ${file === f ? "bg-slate-800" : ""}`} onClick={() => setFile(f)}>{f}</button>
        ))}
      </div>
      <textarea className="input h-96 font-mono text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={save}>Save</button>
        <button className="btn-ghost" onClick={() => setContent(DEFAULTS[file])}>Reset to default</button>
      </div>
    </div>
  );
}
