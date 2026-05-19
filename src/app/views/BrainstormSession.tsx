import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { TextGeneratorModal } from "../components/TextGeneratorModal";

export function BrainstormSession() {
  const { currentProject, rootDir, bank, stage, message, progress, domains, liveIdeas, applyEvent, reset, setView, setCurated, setReport, setProject } = useStore();
  const [running, setRunning] = useState(false);
  const [showTextGen, setShowTextGen] = useState(false);
  const noTexts = !bank?.reference_texts?.length;
  const textCount = bank?.reference_texts?.length ?? 0;

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

  async function handleTextsSaved(count: number) {
    setShowTextGen(false);
    // Reload the project bank so the button unblocks immediately
    if (currentProject) {
      const loaded = (await api.project.load({ rootDir, name: currentProject })) as any;
      setProject(currentProject, rootDir, loaded.brief, loaded.bank, loaded.config);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {showTextGen && currentProject && (
        <TextGeneratorModal
          projectName={currentProject}
          rootDir={rootDir}
          onSaved={handleTextsSaved}
          onClose={() => setShowTextGen(false)}
        />
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Brainstorm</h1>
          {textCount > 0 && (
            <p className="text-xs text-slate-500">{textCount} reference text{textCount !== 1 ? "s" : ""} loaded</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setShowTextGen(true)}>
            ✨ {noTexts ? "Generate texts" : "Add more texts"}
          </button>
          <button className="btn" onClick={start} disabled={running || !currentProject || noTexts}>
            {running ? `${stage}…` : "Run iteration"}
          </button>
        </div>
      </div>

      {progress && (
        <div className="mb-4 h-2 w-full overflow-hidden rounded bg-slate-800">
          <div className="h-full bg-brand-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      )}

      {noTexts && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-300">
          <span>
            No reference texts — ideas can't be generated without them.
          </span>
          <button className="btn ml-4 shrink-0 bg-amber-600 hover:bg-amber-500" onClick={() => setShowTextGen(true)}>
            Generate with AI
          </button>
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
