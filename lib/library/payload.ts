/**
 * What is written to the `documents` table when a signed-in Signer's analysis is saved. Pure, so
 * the result screen and the tests share one rule, and it matches the table's checks in
 * `supabase/migrations/`.
 *
 * Only the Document's text and the analysis result are kept, never the uploaded file: the payload
 * has no field that could hold file bytes, a blob or an upload path. The text is kept exactly as it
 * was analysed, because every Source sentence in the result points at offsets into that text.
 */
import type { AnalysisResult } from "../analysis/types.ts";
import { validateStoredResult } from "./reopen.ts";

/** The longest title, in characters (Unicode code points, as Postgres `char_length` counts them). */
export const MAX_TITLE_LENGTH = 200;

export interface SavedDocumentPayload {
  readonly title: string;
  readonly text: string;
  readonly result: AnalysisResult;
  readonly risk_flag_count: number;
}

/** The title a Document is saved under: the name the result screen shows, cut to the longest title allowed. */
export function titleForDocument(name: string): string {
  const characters = Array.from(name);
  return characters.length > MAX_TITLE_LENGTH ? characters.slice(0, MAX_TITLE_LENGTH).join("") : name;
}

/**
 * The row to insert for one analysis. The result must already validate against the text, so a
 * saved Document is always one that reopens; a result that does not throws here and nothing is
 * saved. `user_id`, `id` and `created_at` are filled in by the database.
 */
export function buildSavedDocument(title: string, documentText: string, result: AnalysisResult): SavedDocumentPayload {
  if (title.trim() === "") throw new RangeError("A saved Document needs a title.");
  if (Array.from(title).length > MAX_TITLE_LENGTH) {
    throw new RangeError(`A saved Document's title is limited to ${MAX_TITLE_LENGTH} characters.`);
  }
  const validated = validateStoredResult(documentText, result);
  return { title, text: documentText, result: validated, risk_flag_count: validated.riskFlags.length };
}
