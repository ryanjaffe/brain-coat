import { useEffect, useState } from "react";
import { useStore } from "../store";
import { api } from "../api";
import type { CuratedIdea } from "../../shared/types";
import type { StrategyPlanState } from "../store";

export function CurationPanel() {
  const {
    curated, setCurated, currentProject, rootDir, brainstormId,
    iter, setView, domains, setStrategyPlan, strategyPlan, reset,
    setCurated: _setCurated, setReport, applyEvent,
  } = useStore();

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [runningNext, setRunningNext] = useState(false);

  function setFeedback(id: string, feedback: CuratedIdea["feedback"]) {
    const next = curated.map((c) => (c.id === id ? { ...c, feedback } : c));
    setCurated(next);
    if (currentProject && brainstormId && iter) {
      api.iter.setFeedback({ rootDir, name: currentProject, brainstormId, iter, curated: next });
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const focused = curated.find((c) => !c.feedback);
      if (!focused) return;
      if (e.key === "l") setFeedback(focused.id, "love");
      if (e.key === "k") setFeedback(focused.id, "like");
      if (e.key === "t") setFeedback(focused.id, "trash");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  async function fetchPlan() {
    if (!currentProject || !brainstormId || !iter) return;
    setLoadingPlan(true);
    try {
      const result = (await api.brainstorm.plan({ rootDir, name: currentProject, brainstormId, iter })) as any;
      setStrategyPlan({ ...result.plan, feedback: result.feedback });
    } finally {
      setLoadingPlan(false);
    }
  }

  async function runNextIteration() {
    if (!currentProject || !brainstormId || !iter) return;
    setRunningNext(true);
    reset();
    setStrategyPlan(undefined as any);
    const off = api.brainstorm.onEvent((e) => applyEvent(e));
    try {
      const result = (await api.brainstorm.run({
        rootDir,
        name: currentProject,
        brainstormId,
        iter: iter + 1,
      })) as any;
      if (result?.curated) setCurated(result.curated);
      if (result?.report) setReport(result.report);
      setView("curation");
    } finally {
      off();
      setRunningNext(false);
    }
  }

  const loved = curated.filter((c) => c.feedback === "love").length;
  const liked = curated.filter((c) => c.feedback === "like").length;
  const trashed = curated.filter((c) => c.feedback === "trash").length;
  const unrated = curated.filter((c) => !c.feedback).length;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review ideas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Rate each idea — your feedback shapes the next run's knowledge probes.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          <kbd className="rounded bg-slate-800 px-1 py-0.5">L</kbd> Love ·{" "}
          <kbd className="rounded bg-slate-800 px-1 py-0.5">K</kbd> Like ·{" "}
          <kbd className="rounded bg-slate-800 px-1 py-0.5">T</kbd> Trash
        </div>
      </div>

      {curated.length === 0 ? (
        <div className="card space-y-2">
          <div className="font-medium text-slate-300">No curated ideas yet</div>
          <div className="text-sm text-slate-500">
            The most common cause is no reference texts in the project. Go to{" "}
            <button className="underline" onClick={() => setView("brainstorm")}>Brainstorm</button>{" "}
            and add texts, then run again.
          </div>
        </div>
      ) : (
        <>
          {/* Feedback summary bar */}
          <div className="mb-4 flex gap-4 rounded-lg bg-slate-900 px-4 py-2 text-sm">
            <span className="text-rose-400">❤️ {loved}</span>
            <span className="text-emerald-400">👍 {liked}</span>
            <span className="text-slate-500">🗑️ {trashed}</span>
            {unrated > 0 && <span className="ml-auto text-slate-600">{unrated} unrated</span>}
          </div>

          <div className="space-y-3">
            {curated.map((c) => {
              const d = domains.find((x) => x.id === c.domain_id);
              return (
                <div
                  key={c.id}
                  className={`card transition-opacity ${c.feedback === "trash" ? "opacity-40" : ""}`}
                >
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-400">{d?.name ?? c.domain_id}</span>
                    <span>score {c.composite.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 text-sm leading-relaxed">{c.idea}</div>
                  {c.curated_reason && (
                    <div className="mt-1.5 text-xs italic text-slate-500">"{c.curated_reason}"</div>
                  )}
                  {Object.keys(c.scores).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {Object.entries(c.scores).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-slate-600">{k}</span>
                          <div className="h-1 flex-1 rounded bg-slate-800">
                            <div className="h-full rounded bg-brand-500" style={{ width: `${v * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-slate-500">{v.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      className={`btn-ghost text-xs ${c.feedback === "love" ? "!text-rose-400" : ""}`}
                      onClick={() => setFeedback(c.id, "love")}
                    >❤️ Love</button>
                    <button
                      className={`btn-ghost text-xs ${c.feedback === "like" ? "!text-emerald-400" : ""}`}
                      onClick={() => setFeedback(c.id, "like")}
                    >👍 Like</button>
                    <button
                      className={`btn-ghost text-xs ${c.feedback === "trash" ? "!text-slate-600" : ""}`}
                      onClick={() => setFeedback(c.id, "trash")}
                    >🗑️ Trash</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Next iteration panel */}
      <div className="mt-8 border-t border-slate-800 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Finished reviewing?</div>
            <div className="text-xs text-slate-500">
              See the report, or plan and run the next iteration using your feedback.
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setView("report")}>View report</button>
            {!strategyPlan ? (
              <button className="btn" onClick={fetchPlan} disabled={loadingPlan || curated.length === 0}>
                {loadingPlan ? "Computing…" : "Plan next run →"}
              </button>
            ) : null}
          </div>
        </div>

        {strategyPlan && (
          <StrategyPreview
            plan={strategyPlan}
            onRun={runNextIteration}
            running={runningNext}
          />
        )}
      </div>
    </div>
  );
}

function StrategyPreview({
  plan,
  onRun,
  running,
}: {
  plan: StrategyPlanState;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-900/10 p-4">
      <div className="mb-3 text-sm font-medium text-brand-400">Next run strategy</div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-slate-900 p-3 text-center">
          <div className="text-xl font-bold text-slate-200">{plan.fresh}</div>
          <div className="mt-0.5 text-xs text-slate-500">Fresh probes</div>
          <div className="mt-1 text-[10px] text-slate-600">New distant fields</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-3 text-center">
          <div className="text-xl font-bold text-slate-200">{plan.deepen.length}</div>
          <div className="mt-0.5 text-xs text-slate-500">Deepen</div>
          <div className="mt-1 text-[10px] text-slate-600">Sub-specialties of loved domains</div>
        </div>
        <div className="rounded-lg bg-slate-900 p-3 text-center">
          <div className="text-xl font-bold text-slate-200">{plan.refresh.length}</div>
          <div className="mt-0.5 text-xs text-slate-500">Refresh</div>
          <div className="mt-1 text-[10px] text-slate-600">New fields with same structure as top ideas</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Based on: {plan.feedback.loved} loved · {plan.feedback.liked} liked · {plan.feedback.trashed} trashed
        </div>
        <button className="btn" onClick={onRun} disabled={running}>
          {running ? "Running next iteration…" : "Run next iteration →"}
        </button>
      </div>
    </div>
  );
}
