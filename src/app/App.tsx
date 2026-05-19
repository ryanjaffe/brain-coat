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

export function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  useEffect(() => {
    (async () => {
      if (!isElectron) {
        setView("projects");
        return;
      }
      const hasKey = await api.key.has();
      setView(hasKey ? "projects" : "key");
    })();
  }, [setView]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="flex-1 overflow-auto">
        {view === "key" && <KeySetup />}
        {view === "projects" && <ProjectsList />}
        {view === "setup" && <ProjectSetup />}
        {view === "brainstorm" && <BrainstormSession />}
        {view === "curation" && <CurationPanel />}
        {view === "report" && <Report />}
        {view === "settings" && <Settings />}
        {view === "prompts" && <PromptEditor />}
      </main>
    </div>
  );
}

function Header() {
  const { view, setView, currentProject, stage, message, progress } = useStore();
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold tracking-tight">
          🧠 Brain Coat
        </span>
        {currentProject && (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
            {currentProject}
          </span>
        )}
        {stage !== "idle" && (
          <span className="text-slate-400">
            · {stage} · {message}
            {progress ? ` (${progress.done}/${progress.total})` : ""}
          </span>
        )}
      </div>
      <nav className="flex gap-1">
        <button className="btn-ghost" onClick={() => setView("projects")}>Projects</button>
        {currentProject && (
          <>
            <button className="btn-ghost" onClick={() => setView("brainstorm")}>Brainstorm</button>
            <button className="btn-ghost" onClick={() => setView("curation")}>Curate</button>
            <button className="btn-ghost" onClick={() => setView("report")}>Report</button>
            <button className="btn-ghost" onClick={() => setView("prompts")}>Prompts</button>
          </>
        )}
        <button className="btn-ghost" onClick={() => setView("settings")}>Settings</button>
      </nav>
    </header>
  );
}
