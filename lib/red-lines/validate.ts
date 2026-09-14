/**
 * What counts as a red line the Signer can keep. Pure, so the red lines screen, the analyse route and
 * the tests share one rule, and it matches the `red_lines` table's checks in
 * `supabase/migrations/`.
 *
 * The text is kept exactly as the Signer wrote it: never trimmed, re-spaced or re-cased. It is the
 * Signer's own words, and the analysis shows them back verbatim.
 */

/** The longest red line, in characters (Unicode code points, as Postgres `char_length` counts them). */
export const MAX_RED_LINE_LENGTH = 300;

export type RedLineTextCheck =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: "blank" }
  | { readonly ok: false; readonly problem: "too-long"; readonly length: number };

/** Length in code points, so an emoji or accented letter counts once, as it does in the database. */
export function redLineLength(text: string): number {
  return Array.from(text).length;
}

export function checkRedLineText(text: string): RedLineTextCheck {
  if (text.trim() === "") return { ok: false, problem: "blank" };
  const length = redLineLength(text);
  if (length > MAX_RED_LINE_LENGTH) return { ok: false, problem: "too-long", length };
  return { ok: true, text };
}
