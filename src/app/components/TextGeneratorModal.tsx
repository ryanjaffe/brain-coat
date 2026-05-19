import { useEffect, useRef, useState } from "react";
import { api } from "../api";

interface GeneratedText {
  label: string;
  description: string;
  content: string;
  selected: boolean;
}

interface Props {
  projectName: string;
  rootDir?: string;
  onSaved: (count: number) => void;
  onClose: () => void;
}

export function TextGeneratorModal({ projectName, rootDir, onSaved, onClose }: Props) {
  const [count, setCount] = useState(5);
  const [status, setStatus] = useState<"idle" | "generating" | "done">("idle");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [texts, setTexts] = useState<GeneratedText[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const offRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    offRef.current = api.texts.onProgress((msg) => setProgress(msg));
    return () => offRef.current?.();
  }, []);

  async function generate() {
    setStatus("generating");
    setTexts([]);
    setProgress("");
    try {
      const result = (await api.texts.generate({ rootDir, name: projectName, count })) as Array<{
        label: string;
        description: string;
        content: string;
      }>;
      setTexts(result.map((t) => ({ ...t, selected: true })));
      setStatus("done");
    } catch (err) {
      setProgress(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("idle");
    }
  }

  async function save() {
    const chosen = texts.filter((t) => t.selected);
    if (!chosen.length) return;
    setSaving(true);
    await api.texts.save({ rootDir, name: projectName, texts: chosen });
    onSaved(chosen.length);
    setSaving(false);
  }

  function toggle(i: number) {
    setTexts((prev) => prev.map((t, idx) => (idx === i ? { ...t, selected: !t.selected } : t)));
  }

  const selectedCount = texts.filter((t) => t.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate reference texts with AI</h2>
          <button className="btn-ghost text-xs" onClick={onClose}>✕ Close</button>
        </div>

        <p className="text-sm text-slate-400">
          Grok reads your project brief and writes <strong>dense, angle-specific</strong> reference
          texts — each covering a distinct sub-problem, case study, or mechanism. These feed the
          idea engine as collision inputs.
        </p>

        {status === "idle" || status === "generating" ? (
          <div className="flex items-center gap-3">
            <label className="label whitespace-nowrap">Number of texts</label>
            <input
              className="input w-20"
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={status === "generating"}
            />
            <button
              className="btn"
              onClick={generate}
              disabled={status === "generating"}
            >
              {status === "generating" ? "Generating…" : "Generate"}
            </button>
          </div>
        ) : null}

        {progress && (
          <div className="text-xs text-slate-400">{progress}</div>
        )}

        {texts.length > 0 && (
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "50vh" }}>
            {texts.map((t, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 transition-colors ${
                  t.selected ? "border-brand-500/60 bg-slate-800/60" : "border-slate-700 bg-slate-800/20 opacity-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={t.selected}
                    onChange={() => toggle(i)}
                    className="mt-0.5 accent-brand-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.label}</span>
                      <button
                        className="btn-ghost shrink-0 py-0.5 text-xs"
                        onClick={() => setExpanded(expanded === i ? null : i)}
                      >
                        {expanded === i ? "collapse" : "preview"}
                      </button>
                    </div>
                    <div className="text-xs text-slate-500">{t.description}</div>
                    {expanded === i && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded bg-slate-950 p-2 text-xs leading-relaxed text-slate-300">
                        {t.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "done" && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-sm text-slate-400">
              {selectedCount} of {texts.length} selected
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={generate}>Regenerate</button>
              <button className="btn" disabled={selectedCount === 0 || saving} onClick={save}>
                {saving ? "Saving…" : `Add ${selectedCount} text${selectedCount !== 1 ? "s" : ""} to project`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
