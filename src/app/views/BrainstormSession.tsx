import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export function BrainstormSession() {
  const { currentProject, rootDir, bank, stage, message, progress, domains, liveIdeas, applyEvent, reset, setView, setCurated, setReport } = useStore();
  const [running, setRunning] = useState(false);
  const noTexts = !bank?.reference_texts?.length;

  useEffect(() => {
    const off = api.brainstorm.onEvent((e) => applyEvent(e));
    return () => { off(); };
  }, [applyEvent]);

  async function start() {
    if (!currentProject) return;
    reset();
    setRunning(true);
    try {
      const result = (await api.brainstorm.run({ rootDir, name: currentProject })) as any;
      if (result?.curated) setCurated(result.curated);
      if (result?.report) setReport(result.report);
      setView("curation");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brainstorm</h1>
        <button className="btn" onClick={start} disabled={running || !currentProject || noTexts}>
          {running ? `${stage}…` : "Run iteration"}
        </button>
      </div>
      {progress && (
        <div className="mb-4 h-2 w-full overflow-hidden rounded bg-slate-800">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      )}
      {noTexts && (
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-300">
          No reference texts found in this project. Go to{" "}
          <button className="underline" onClick={() => setView("setup")}>Project Setup</button>{" "}
          and add at least one text with content before running.
        </div>
      )}
      {message && <div className="mb-4 text-sm text-slate-400">{message}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Domain bank ({domains.length})</h2>
          <div className="space-y-2">
            {domains.map((d) => (
              <div key={d.id} className="card animate-slide-in">
                <div className="text-sm font-semibold text-brand-500">{d.name}</div>
                <div className="mt-1 text-xs text-slate-400">{d.active_principle}</div>
                <div className="mt-2 text-xs italic text-slate-500">→ {d.bridging_question}</div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-300">
            Collisions ({liveIdeas.length} ideas streamed)
          </h2>
          <div className="space-y-2">
            {liveIdeas.slice(-50).reverse().map((i) => (
              <div key={i.id} className="card animate-slide-in">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{i.text_id} × {i.domain_id}</div>
                <div className="mt-1 text-sm">{i.idea || <span className="text-rose-400">failed: {i.error}</span>}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
