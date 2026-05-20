import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

interface ProjectMeta {
  createdAt: string | null;
  briefSnippet: string | null;
  brainstormCount: number;
  textCount: number;
}

export function ProjectsList() {
  const [projects, setProjects] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, ProjectMeta>>({});
  const [rootDir, setRootDir] = useState<string>();
  const setView = useStore((s) => s.setView);
  const setProject = useStore((s) => s.setProject);

  async function refresh(dir?: string) {
    const list = await api.projects.list(dir);
    const resolved = dir ?? (await api.projects.defaultDir());
    setProjects(list);
    setRootDir(resolved);
    // Load metadata for each project in parallel
    const entries = await Promise.all(
      list.map(async (name) => {
        try {
          const m = (await api.projects.metadata({ rootDir: resolved, name })) as ProjectMeta;
          return [name, m] as const;
        } catch {
          return [name, null] as const;
        }
      }),
    );
    const map: Record<string, ProjectMeta> = {};
    for (const [name, m] of entries) if (m) map[name] = m;
    setMeta(map);
  }

  useEffect(() => { refresh(); }, []);

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
          <button
            className="btn"
            onClick={() => { useStore.getState().setProject("", rootDir); setView("setup"); }}
          >
            New project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="card text-slate-400">
          <div className="font-medium">No projects yet</div>
          <div className="mt-1 text-xs">Create a new project to start brainstorming — you'll define a problem brief, add reference texts, and the AI generates ideas by colliding those texts with distant knowledge fields.</div>
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const m = meta[p];
            return (
              <li key={p}>
                <button
                  className="card w-full text-left hover:border-brand-500/50 transition-colors"
                  onClick={() => open(p)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium">{p}</div>
                      {m?.briefSnippet && (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500">{m.briefSnippet}{m.briefSnippet.length >= 120 ? "…" : ""}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-600">
                      {m ? (
                        <>
                          <div>{m.brainstormCount} session{m.brainstormCount !== 1 ? "s" : ""}</div>
                          <div>{m.textCount} text{m.textCount !== 1 ? "s" : ""}</div>
                          {m.createdAt && (
                            <div className="text-slate-700">{new Date(m.createdAt).toLocaleDateString()}</div>
                          )}
                        </>
                      ) : <div className="text-slate-700">loading…</div>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
