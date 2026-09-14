import type { DocumentPart } from "./parts.ts";

/**
 * How many parts of a long Document are sent to the model at once. Two, not all of them: the calls
 * go to one provider (Fireworks, pinned with no fallback), whose rate limit a burst of parallel
 * requests would hit, and a rate-limit error fails the whole result. Two still roughly halves the
 * wait against the route's time limit. A Document in one part makes one call either way.
 */
const PART_CONCURRENCY = 2;

/**
 * Runs every part, at most `PART_CONCURRENCY` at a time, and returns their results in part order.
 * Any part failing (the model call rejecting, a malformed answer, a citation that does not match)
 * fails the whole result: no further part is started, and the error of the earliest failed part
 * is thrown once the parts already running have settled. There is no partial result.
 */
export async function runEveryPart<T>(parts: readonly DocumentPart[], task: (part: DocumentPart) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  const failures: { index: number; error: unknown }[] = [];
  let next = 0;
  const worker = async () => {
    while (failures.length === 0 && next < parts.length) {
      const part = parts[next++];
      try {
        results[part.index] = await task(part);
      } catch (error) {
        if (parts.length > 1 && error instanceof Error) {
          error.message = `Part ${part.index + 1} of ${parts.length}: ${error.message}`;
        }
        failures.push({ index: part.index, error });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, worker));
  if (failures.length > 0) {
    throw failures.sort((a, b) => a.index - b.index)[0].error;
  }
  return results;
}
