import type { AnalyseRequestBody } from "./api.ts";
import type { RedLine } from "./types.ts";

/**
 * True when a Document has nothing but whitespace in it. The check never changes the text: the
 * caller keeps sending the string exactly as it arrived.
 */
export function isBlankDocument(text: string): boolean {
  return text.trim() === "";
}

/**
 * The JSON body of POST /api/analyse for a Document's text, whether it was read from a file or
 * pasted. The text goes in exactly as given: no trimming, no line-ending or whitespace changes.
 */
export function buildAnalyseRequestBody(documentText: string, redLines: readonly RedLine[]): string {
  const body: AnalyseRequestBody = { text: documentText, redLines: [...redLines] };
  return JSON.stringify(body);
}
