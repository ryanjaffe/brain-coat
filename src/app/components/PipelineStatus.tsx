import { useStore } from "../store";
import type { PipelineStage } from "../../shared/types";

const STEPS: { stage: PipelineStage; label: string }[] = [
  { stage: "domains", label: "Knowledge probes" },
  { stage: "ideas",   label: "Idea generation" },
  { stage: "scoring", label: "Scoring" },
  { stage: "curation",label: "Curation" },
];

const ORDER: PipelineStage[] = ["domains", "ideas", "scoring", "curation", "done"];

function stageIndex(s: PipelineStage) {
  return ORDER.indexOf(s);
}

const STAGE_LABELS: Partial<Record<PipelineStage, string>> = {
  domains:  "Finding knowledge probes…",
  ideas:    "Generating ideas…",
  scoring:  "Scoring ideas…",
  curation: "Selecting the best…",
  done:     "Complete",
  error:    "Run failed",
};

export function PipelineStatus() {
  const { stage, stageMessage, overallPct } = useStore();
  if (stage === "idle") return null;

  const activeIdx = stageIndex(stage);

  return (
    <div className="border-b border-slate-800 bg-slate-900/80 px-4 pb-2 pt-2">
      {/* Step indicators */}
      <div className="mb-1.5 flex items-center gap-0">
        {STEPS.map((s, i) => {
          const idx = stageIndex(s.stage);
          const done = activeIdx > idx || stage === "done";
          const active = activeIdx === idx && stage !== "done";
          return (
            <div key={s.stage} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    done
                      ? "bg-brand-500 text-white"
                      : active
                      ? "bg-brand-500/30 text-brand-400 ring-1 ring-brand-500"
                      : "bg-slate-800 text-slate-600"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs ${
                    done ? "text-slate-400" : active ? "text-slate-200" : "text-slate-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-px w-8 ${done ? "bg-brand-500/50" : "bg-slate-800"}`} />
              )}
            </div>
          );
        })}
        {stage === "error" && (
          <span className="ml-3 text-xs text-rose-400">✗ {stageMessage}</span>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      {/* Stage message */}
      {stageMessage && stage !== "done" && stage !== "error" && (
        <div className="mt-1 text-[11px] text-slate-500">{STAGE_LABELS[stage] ?? ""} {stageMessage}</div>
      )}
    </div>
  );
}
