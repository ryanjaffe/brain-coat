import { useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export function Settings() {
  const { currentProject, rootDir, config } = useStore();
  const [key, setKey] = useState("");
  const [testResult, setTestResult] = useState<string>();
  const [testLoading, setTestLoading] = useState(false);

  async function rotate() {
    setTestLoading(true);
    await api.key.set(key);
    const t = await api.key.test();
    setTestResult(t.ok ? "✅ Connected" : `❌ ${t.error}`);
    setTestLoading(false);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-medium">API key</h2>
        <p className="text-xs text-slate-500">
          Stored encrypted in your OS keychain via Electron <code>safeStorage</code>. Never written to disk in plaintext.
        </p>
        <input
          className="input"
          type="password"
          placeholder="xai-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button className="btn" disabled={!key || testLoading} onClick={rotate}>
            {testLoading ? "Testing…" : "Save & test"}
          </button>
          {testResult && <span className="text-sm">{testResult}</span>}
        </div>
      </section>

      {config && currentProject && (
        <section className="card mt-4 space-y-3">
          <h2 className="font-medium">Current project — {currentProject}</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="label">Model</div>
              <div className="mt-1 font-mono text-slate-300">{config.llm_backend}</div>
            </div>
            <div>
              <div className="label">Concurrency</div>
              <div className="mt-1 text-slate-300">{config.concurrency} parallel calls</div>
            </div>
            <div>
              <div className="label">Temperatures</div>
              <div className="mt-1 space-y-0.5 text-slate-400">
                <div>Probes: {config.temperatures.domain}</div>
                <div>Ideas: {config.temperatures.idea}</div>
                <div>Scoring: {config.temperatures.score}</div>
                <div>Curation: {config.temperatures.curate}</div>
              </div>
            </div>
            <div>
              <div className="label">Strategy weights</div>
              <div className="mt-1 space-y-0.5 text-slate-400">
                <div>Fresh: {config.strategy_weights.fresh}</div>
                <div>Deepen: {config.strategy_weights.deepen}</div>
                <div>Refresh: {config.strategy_weights.refresh}</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Edit these by updating <code>project_config.yaml</code> in the project folder, or re-create the project via Setup.
          </p>
        </section>
      )}

      <section className="card mt-4 text-xs text-slate-500">
        <h2 className="mb-1 font-medium text-slate-400">Token usage</h2>
        Each completed iteration writes an <code>iteration_meta.json</code> with call count and token totals.
        Check <strong>History</strong> for a per-iteration breakdown.
      </section>
    </div>
  );
}
