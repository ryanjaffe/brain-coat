import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import type { BrainstormSummary } from "../../shared/types";

export function SessionHistory() {
  const { currentProject, rootDir, setView, setCurated, setHistory, history, brainstormId: activeBsId, iter: activeIter } = useStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    (api.project.history({ rootDir, name: currentProject }) as Promise<BrainstormSummary[]>)
      .then((h) => setHistory(h))
      .finally(() => setLoading(false));
  }, [currentProject, rootDir]);

  async function loadIter(bs: BrainstormSummary["brainstormId"], iter: number) {
    if (!currentProject) return;
    const data = (await api.project.loadIter({ rootDir, name: currentProject, brainstormId: bs, iter })) as any;
    if (data.curated) {
      setCurated(data.curated);
      // Set active brainstorm context in store
      useStore.setState({ brainstormId: bs, iter, domains: data.domains ?? [] });
      setView("curation");
    }
  }

  if (!currentProject) {
    return <div className="mx-auto max-w-3xl p-8 text-slate-400">No project open.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Session history</h1>
        <p className="mt-1 text-xs text-slate-500">All brainstorm sessions for {currentProject}.</p>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading…</div>}

      {!loading && history.length === 0 && (
        <div className="card text-slate-400">
          No sessions yet — run a brainstorm to get started.
        </div>
      )}

      <div className="space-y-4">
        {[...history].reverse().map((bs) => (
          <div key={bs.brainstormId} className="card">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-300">
                Session {bs.brainstormId}
                {bs.brainstormId === activeBsId && (
                  <span className="ml-2 rounded bg-brand-500/20 px-1.5 text-xs text-brand-400">active</span>
                )}
              </div>
              <div className="text-xs text-slate-600">
                {bs.iterations.length} iteration{bs.iterations.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="space-y-2">
              {bs.iterations.map((it) => (
                <button
                  key={it.iter}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-brand-500/50 transition-colors"
                  onClick={() => loadIter(bs.brainstormId, it.iter)}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">Iteration {it.iter}</span>
                    <div className="flex gap-3 text-slate-600">
                      <span>{it.curatedCount} ideas curated</span>
                      <span>{it.meta.call_count} API calls</span>
                      <span>{new Date(it.meta.started_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {it.topIdea && (
                    <div className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                      Top idea: {it.topIdea}
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] text-slate-700">
                    ~{it.meta.approx_prompt_tokens + it.meta.approx_completion_tokens} tokens ·{" "}
                    {it.meta.model} · click to load into Review
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
