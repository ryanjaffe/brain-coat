import type { CuratedIdea, Domain, StrategyWeights } from "@shared/types";

export interface StrategyPlan {
  fresh: number;
  deepen: { domainId: string }[];
  refresh: { fromIdeaId: string }[];
}

/**
 * Decide how the next iteration's domain bank should be composed,
 * given user feedback on the previous iteration.
 *
 * - Fresh always runs.
 * - Deepen fires for any domain that produced a loved idea.
 * - Refresh fires if love+like count >= 3.
 */
export function planNextIteration(args: {
  domains: Domain[];
  curated: CuratedIdea[];
  weights: StrategyWeights;
  totalDomains?: number;
}): StrategyPlan {
  const { curated, weights, totalDomains = 10 } = args;
  const lovedDomainIds = new Set(
    curated.filter((c) => c.feedback === "love").map((c) => c.domain_id),
  );
  const positive = curated.filter((c) => c.feedback === "love" || c.feedback === "like");

  const totalW = weights.fresh + weights.deepen + weights.refresh || 1;
  const freshShare = Math.round((weights.fresh / totalW) * totalDomains);
  const deepenShare = lovedDomainIds.size > 0 ? Math.round((weights.deepen / totalW) * totalDomains) : 0;
  const refreshShare = positive.length >= 3 ? Math.round((weights.refresh / totalW) * totalDomains) : 0;

  const deepen = [...lovedDomainIds].slice(0, deepenShare).map((id) => ({ domainId: id }));
  const refresh = positive
    .sort((a, b) => b.composite - a.composite)
    .slice(0, refreshShare)
    .map((c) => ({ fromIdeaId: c.id }));

  return {
    fresh: Math.max(1, totalDomains - deepen.length - refresh.length),
    deepen,
    refresh,
  };
}
