import ReactMarkdown from "react-markdown";
import { useStore } from "../store";

export function Report() {
  const md = useStore((s) => s.reportMd);

  function copy() {
    if (md) navigator.clipboard.writeText(md);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Report</h1>
        <button className="btn-ghost" onClick={copy} disabled={!md}>
          Copy markdown
        </button>
      </div>

      {md ? (
        <article className="prose prose-invert prose-sm max-w-none
          prose-headings:font-semibold prose-headings:text-slate-100
          prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-li:text-slate-300
          prose-strong:text-slate-200
          prose-em:text-slate-400
          prose-code:rounded prose-code:bg-slate-800 prose-code:px-1 prose-code:text-brand-400
          prose-hr:border-slate-800">
          <ReactMarkdown>{md}</ReactMarkdown>
        </article>
      ) : (
        <div className="card text-slate-400">
          <div className="font-medium">No report yet</div>
          <div className="mt-1 text-xs">Run a brainstorm first — the report is generated automatically when a run completes.</div>
        </div>
      )}
    </div>
  );
}
