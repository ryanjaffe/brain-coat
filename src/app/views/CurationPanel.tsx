import { useEffect } from "react";
import { useStore } from "../store";
import { api } from "../api";
import type { CuratedIdea } from "../../shared/types";

export function CurationPanel() {
  const { curated, setCurated, currentProject, rootDir, brainstormId, iter, setView, domains } = useStore();

  function setFeedback(id: string, feedback: CuratedIdea["feedback"]) {
    const next = curated.map((c) => (c.id === id ? { ...c, feedback } : c));
    setCurated(next);
    if (currentProject && brainstormId && iter) {
      api.iter.setFeedback({ rootDir, name: currentProject, brainstormId, iter, curated: next });
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const focused = curated.find((c) => !c.feedback);
      if (!focused) return;
      if (e.key === "l") setFeedback(focused.id, "love");
      if (e.key === "k") setFeedback(focused.id, "like");
      if (e.key === "t") setFeedback(focused.id, "trash");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function endIteration() {
    if (currentProject && brainstormId && iter) {
      const plan = await api.iter.planNext({ rootDir, name: currentProject, brainstormId, iter });
      alert(`Next iteration plan: ${plan.fresh} Fresh, ${plan.deepen.length} Deepen, ${plan.refresh.length} Refresh.`);
    }
    setView("report");
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Curated ideas ({curated.length})</h1>
        <div className="text-xs text-slate-500">L=Love · K=Like · T=Trash</div>
      </div>
      {curated.length === 0 ? (
        <div className="card text-slate-400">Nothing curated yet — run a brainstorm first.</div>
      ) : (
        <div className="space-y-3">
          {curated.map((c) => {
            const d = domains.find((x) => x.id === c.domain_id);
            return (
              <div key={c.id} className="card">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{d?.name ?? c.domain_id} · {c.text_id}</span>
                  <span>composite {c.composite.toFixed(2)}</span>
                </div>
                <div className="mt-2 text-sm">{c.idea}</div>
                {c.curated_reason && <div className="mt-2 text-xs italic text-slate-400">{c.curated_reason}</div>}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(c.scores).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-24 text-slate-500">{k}</span>
                      <div className="h-1.5 flex-1 rounded bg-slate-800">
                        <div className="h-full rounded bg-brand-500" style={{ width: `${v * 100}%` }} />
                      </div>
                      <span className="w-10 text-right text-slate-400">{v.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className={`btn-ghost ${c.feedback === "love" ? "text-rose-400" : ""}`} onClick={() => setFeedback(c.id, "love")}>❤️ Love</button>
                  <button className={`btn-ghost ${c.feedback === "like" ? "text-emerald-400" : ""}`} onClick={() => setFeedback(c.id, "like")}>👍 Like</button>
                  <button className={`btn-ghost ${c.feedback === "trash" ? "text-slate-500" : ""}`} onClick={() => setFeedback(c.id, "trash")}>🗑️ Trash</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <button className="btn" onClick={endIteration}>End iteration → plan next</button>
      </div>
    </div>
  );
}
