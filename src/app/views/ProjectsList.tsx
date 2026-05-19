import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export function ProjectsList() {
  const [projects, setProjects] = useState<string[]>([]);
  const [rootDir, setRootDir] = useState<string>();
  const setView = useStore((s) => s.setView);
  const setProject = useStore((s) => s.setProject);

  async function refresh(dir?: string) {
    setProjects(await api.projects.list(dir));
    setRootDir(dir ?? (await api.projects.defaultDir()));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function pick() {
    const dir = await api.projects.pickDir();
    if (dir) refresh(dir);
  }

  async function open(name: string) {
    const loaded = (await api.project.load({ rootDir, name })) as any;
    setProject(name, rootDir, loaded.brief, loaded.bank, loaded.config);
    setView("brainstorm");
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-xs text-slate-500">Stored at {rootDir}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={pick}>Change folder</button>
          <button className="btn" onClick={() => { useStore.getState().setProject("", rootDir); setView("setup"); }}>
            New project
          </button>
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="card text-slate-400">No projects yet. Create one to get started.</div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p}>
              <button className="card w-full text-left hover:border-brand-500" onClick={() => open(p)}>
                <div className="font-medium">{p}</div>
                <div className="text-xs text-slate-500">click to open</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
