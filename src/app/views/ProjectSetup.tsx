import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type { BriefValidated, InputBank, ProjectConfig, ReferenceText, ScoringAxis } from "../../shared/types";

export function ProjectSetup() {
  const setView = useStore((s) => s.setView);
  const setProject = useStore((s) => s.setProject);
  const rootDir = useStore((s) => s.rootDir);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [criteria, setCriteria] = useState("");
  const [axes, setAxes] = useState<ScoringAxis[]>([
    { name: "Originality", weight: 0.4 },
    { name: "Feasibility", weight: 0.3 },
    { name: "Relevance", weight: 0.3 },
  ]);
  const [texts, setTexts] = useState<ReferenceText[]>([
    { id: "T01", label: "Text 1", description: "", content: "" },
  ]);
  const [forbidden, setForbidden] = useState("");
  const [concurrency, setConcurrency] = useState(4);
  const [strategy, setStrategy] = useState({ fresh: 0.5, deepen: 0.25, refresh: 0.25 });

  function addAxis() {
    setAxes([...axes, { name: "", weight: 0.1 }]);
  }
  function addText() {
    if (texts.length >= 10) return;
    const id = `T${String(texts.length + 1).padStart(2, "0")}`;
    setTexts([...texts, { id, label: `Text ${texts.length + 1}`, description: "", content: "" }]);
  }

  async function save() {
    const brief: BriefValidated = {
      problem,
      good_idea_criteria: criteria,
      scoring_axes: axes.filter((a) => a.name.trim()),
    };
    const bank: InputBank = {
      forbidden_topics: forbidden.split(",").map((s) => s.trim()).filter(Boolean),
      reference_texts: texts.filter((t) => t.content.trim()),
    };
    const config: ProjectConfig = {
      name,
      llm_backend: "grok-4-3",
      concurrency,
      temperatures: { domain: 0.95, idea: 0.92, score: 0.2, curate: 0.4 },
      strategy_weights: strategy,
      created_at: new Date().toISOString(),
    };
    await api.project.create({ rootDir, name, brief, bank, config });
    setProject(name, rootDir, brief, bank, config);
    setView("brainstorm");
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-1 text-2xl font-semibold">New project</h1>
      <p className="mb-6 text-xs text-slate-500">Step {step} of 3</p>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">Project name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="my_brainstorm" />
          </div>
          <div>
            <label className="label">Problem brief</label>
            <textarea className="input mt-1 h-28" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Describe your ideation problem…" />
          </div>
          <div>
            <label className="label">What makes a good idea? What are you NOT looking for?</label>
            <textarea className="input mt-1 h-24" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
          </div>
          <div>
            <label className="label">Scoring axes</label>
            <div className="mt-2 space-y-2">
              {axes.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" placeholder="Axis name" value={a.name} onChange={(e) => {
                    const copy = [...axes]; copy[i] = { ...a, name: e.target.value }; setAxes(copy);
                  }} />
                  <input className="input w-24" type="number" step="0.05" min="0" max="1" value={a.weight} onChange={(e) => {
                    const copy = [...axes]; copy[i] = { ...a, weight: Number(e.target.value) }; setAxes(copy);
                  }} />
                </div>
              ))}
              <button className="btn-ghost" onClick={addAxis}>+ axis</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="label">Reference texts (up to 10)</label>
            <div className="mt-2 space-y-3">
              {texts.map((t, i) => (
                <div key={t.id} className="card space-y-2">
                  <div className="flex gap-2">
                    <span className="text-xs text-slate-500">{t.id}</span>
                    <input className="input flex-1" placeholder="Label" value={t.label} onChange={(e) => {
                      const c = [...texts]; c[i] = { ...t, label: e.target.value }; setTexts(c);
                    }} />
                  </div>
                  <textarea className="input h-24" placeholder="Paste or type reference content…" value={t.content} onChange={(e) => {
                    const c = [...texts]; c[i] = { ...t, content: e.target.value }; setTexts(c);
                  }} />
                </div>
              ))}
              {texts.length < 10 && <button className="btn-ghost" onClick={addText}>+ text</button>}
            </div>
          </div>
          <div>
            <label className="label">Forbidden topics (comma-separated)</label>
            <input className="input mt-1" value={forbidden} onChange={(e) => setForbidden(e.target.value)} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="label">Parallel call concurrency</label>
            <input className="input mt-1" type="number" min={1} max={8} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Strategy weights (only used from iteration 2 onward)</label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(["fresh", "deepen", "refresh"] as const).map((k) => (
                <div key={k} className="card">
                  <div className="text-xs uppercase">{k}</div>
                  <input className="input mt-2" type="number" step="0.05" min="0" max="1" value={strategy[k]} onChange={(e) => setStrategy({ ...strategy, [k]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button className="btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</button>
        {step < 3 ? (
          <button className="btn" onClick={() => setStep(step + 1)} disabled={step === 1 && !name}>Next</button>
        ) : (
          <button className="btn" onClick={save} disabled={!name || !problem}>Create project</button>
        )}
      </div>
    </div>
  );
}
