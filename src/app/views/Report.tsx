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
        <button className="btn-ghost" onClick={copy} disabled={!md}>Copy markdown</button>
      </div>
      {md ? (
        <article className="prose prose-invert max-w-none">
          <ReactMarkdown>{md}</ReactMarkdown>
        </article>
      ) : (
        <div className="card text-slate-400">No report yet — run a brainstorm.</div>
      )}
    </div>
  );
}
