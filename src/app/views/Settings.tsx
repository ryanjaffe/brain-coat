import { useState } from "react";
import { api } from "../api";

export function Settings() {
  const [key, setKey] = useState("");
  const [testResult, setTestResult] = useState<string>();

  async function rotate() {
    await api.key.set(key);
    const t = await api.key.test();
    setTestResult(t.ok ? "✅ Key works" : `❌ ${t.error}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
      <section className="card space-y-3">
        <h2 className="font-medium">API key</h2>
        <p className="text-xs text-slate-500">Stored encrypted in OS keychain via safeStorage.</p>
        <input className="input" type="password" placeholder="xai-…" value={key} onChange={(e) => setKey(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn" disabled={!key} onClick={rotate}>Save & test</button>
          {testResult && <span className="text-sm">{testResult}</span>}
        </div>
      </section>
      <section className="card mt-4 text-sm text-slate-400">
        Default temperatures, concurrency, and projects directory are configured per-project in Setup.
        Token usage is summarized in each iteration's <code>iteration_meta.json</code>.
      </section>
    </div>
  );
}
