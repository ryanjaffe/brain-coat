/**
 * Run async tasks with a max concurrency, calling `onResult` as each finishes.
 */
export async function pMapLimit<I, O>(
  items: I[],
  limit: number,
  worker: (item: I, index: number) => Promise<O>,
  onResult?: (result: O, item: I, index: number) => void,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let cursor = 0;
  async function runOne() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const out = await worker(items[i], i);
      results[i] = out;
      onResult?.(out, items[i], i);
    }
  }
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => runOne());
  await Promise.all(runners);
  return results;
}
