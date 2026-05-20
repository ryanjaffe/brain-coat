import { useEffect } from "react";
import { useStore } from "./store";
import { api, isElectron } from "./api";
import { KeySetup } from "./views/KeySetup";
import { ProjectSetup } from "./views/ProjectSetup";
import { BrainstormSession } from "./views/BrainstormSession";
import { CurationPanel } from "./views/CurationPanel";
import { Report } from "./views/Report";
import { ProjectsList } from "./views/ProjectsList";
import { Settings } from "./views/Settings";
import { PromptEditor } from "./views/PromptEditor";
import { SessionHistory } from "./views/SessionHistory";
import { PipelineStatus } from "./components/PipelineStatus";

export function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  useEffect(() => {
    (async () => {
      if (!isElectron) { setView("projects"); return; }
      const hasKey = await api.key.has();
      setView(hasKey ? "projects" : "key");
    })();
  }, [setView]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <PipelineStatus />
      <main className="flex-1 overflow-auto">
        {view === "key"       && <KeySetup />}
        {view === "projects"  && <ProjectsList />}
        {view === "setup"     && <ProjectSetup />}
        {view === "brainstorm"&& <BrainstormSession />}
        {view === "curation"  && <CurationPanel />}
        {view === "report"    && <Report />}
        {view === "history"   && <SessionHistory />}
        {view === "settings"  && <Settings />}
        {view === "prompts"   && <PromptEditor />}
      </main>
    </div>
  );
}

function Header() {
  const { view, setView, currentProject, stage, brainstormId, iter } = useStore();
  const isRunning = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <button className="text-base font-semibold tracking-tight hover:opacity-80" onClick={() => setView("projects")}>
          🧠 Brain Coat
        </button>
        {currentProject && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">{currentProject}</span>
        )}
        {brainstormId && iter && (
          <span className="text-xs text-slate-600">
            session {brainstormId} · iter {iter}
          </span>
        )}
        {isRunning && (
          <span className="flex items-center gap-1.5 text-xs text-brand-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
            Running
          </span>
        )}
      </div>

      <nav className="flex gap-1">
        <button className={`btn-ghost ${view === "projects" ? "bg-slate-800" : ""}`} onClick={() => setView("projects")}>Projects</button>
        {currentProject && (
          <>
            <button className={`btn-ghost ${view === "brainstorm" ? "bg-slate-800" : ""}`} onClick={() => setView("brainstorm")}>
              Brainstorm
            </button>
            <button className={`btn-ghost ${view === "curation" ? "bg-slate-800" : ""}`} onClick={() => setView("curation")}>
              Review ideas
            </button>
            <button className={`btn-ghost ${view === "report" ? "bg-slate-800" : ""}`} onClick={() => setView("report")}>Report</button>
            <button className={`btn-ghost ${view === "history" ? "bg-slate-800" : ""}`} onClick={() => setView("history")}>History</button>
            <button className={`btn-ghost ${view === "prompts" ? "bg-slate-800" : ""}`} onClick={() => setView("prompts")}>Prompts</button>
          </>
        )}
        <button className={`btn-ghost ${view === "settings" ? "bg-slate-800" : ""}`} onClick={() => setView("settings")}>Settings</button>
      </nav>
    </header>
  );
}
