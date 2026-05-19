import type { BriefValidated, CuratedIdea, Domain, IterationMeta } from "@shared/types";

export function renderReport(args: {
  brief: BriefValidated;
  curated: CuratedIdea[];
  domains: Domain[];
  meta: IterationMeta;
}): string {
  const { brief, curated, domains, meta } = args;
  const domainById = new Map(domains.map((d) => [d.id, d]));
  const byDomain = new Map<string, CuratedIdea[]>();
  for (const c of [...curated].sort((a, b) => b.composite - a.composite)) {
    const list = byDomain.get(c.domain_id) ?? [];
    list.push(c);
    byDomain.set(c.domain_id, list);
  }

  const sections: string[] = [];
  sections.push(`# Brainstorm Report\n`);
  sections.push(`## Brief\n${brief.problem}\n`);
  sections.push(`## What counts as a good idea\n${brief.good_idea_criteria}\n`);
  sections.push(`## Top curated ideas\n`);
  for (const [domainId, ideas] of byDomain) {
    const d = domainById.get(domainId);
    sections.push(`### ${d?.name ?? domainId}`);
    if (d) sections.push(`_Active principle:_ ${d.active_principle}\n`);
    for (const i of ideas) {
      sections.push(`- **(${i.composite.toFixed(2)})** ${i.idea}${i.curated_reason ? `\n  _${i.curated_reason}_` : ""}`);
    }
    sections.push("");
  }
  sections.push(`## Iteration metadata`);
  sections.push(`- Model: ${meta.model}`);
  sections.push(`- Calls: ${meta.call_count}`);
  sections.push(`- Approx tokens: ${meta.approx_prompt_tokens} prompt + ${meta.approx_completion_tokens} completion`);
  sections.push(`- Started: ${meta.started_at}`);
  sections.push(`- Finished: ${meta.finished_at ?? "—"}`);
  return sections.join("\n");
}
