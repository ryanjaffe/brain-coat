import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export function KeySetup() {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "bad">("idle");
  const [error, setError] = useState<string | undefined>();
  const setView = useStore((s) => s.setView);

  async function save() {
    setStatus("saving");
    setError(undefined);
    try {
      await api.key.set(key);
      const test = await api.key.test();
      if (test.ok) {
        setStatus("ok");
        setTimeout(() => setView("projects"), 600);
      } else {
        setStatus("bad");
        setError(test.error);
      }
    } catch (e) {
      setStatus("bad");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-2 text-2xl font-semibold">Connect to Grok</h1>
      <p className="mb-6 text-sm text-slate-400">
        Your <code>XAI_API_KEY</code> is stored encrypted via Electron <code>safeStorage</code>{" "}
        (OS keychain). It is never written to disk in plaintext.
      </p>
      <label className="label">XAI API Key</label>
      <input
        className="input mt-1"
        type="password"
        placeholder="xai-…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <div className="mt-4 flex items-center gap-2">
        <button className="btn" disabled={!key || status === "saving"} onClick={save}>
          {status === "saving" ? "Testing…" : "Save & test"}
        </button>
        {status === "ok" && <span className="text-emerald-400">✅ Connected</span>}
        {status === "bad" && <span className="text-rose-400">❌ {error}</span>}
      </div>
    </div>
  );
}
