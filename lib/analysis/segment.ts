/**
 * Splits stored Document text into sentence units with exact offsets.
 *
 * Nothing is normalised: every unit's `text` is exactly `documentText.slice(start, end)`.
 * Whitespace between units belongs to no unit; whitespace inside a unit is kept as it is.
 *
 * Boundaries:
 * - a line break always ends a unit (headings, list lines and signature lines stand alone);
 * - `.`, `!` or `?`, optionally followed by closing quotes or brackets, ends a unit when the next
 *   non-space character on the line starts a new sentence (a capital, digit, or opening quote or
 *   bracket), unless the word before the period is a known abbreviation or a single initial.
 */

export interface SentenceUnit {
  id: string;
  start: number;
  end: number;
  text: string;
}

const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "etc",
  "inc",
  "ltd",
  "co",
  "corp",
  "llc",
  "no",
  "nos",
  "mr",
  "mrs",
  "ms",
  "dr",
  "st",
  "sec",
  "art",
  "para",
  "cl",
  "vs",
  "u.s",
  "u.k",
  "approx",
]);

const CLOSERS = new Set(['"', "'", ")", "]", "”", "’"]);
const OPENERS = new Set(['"', "'", "(", "[", "“", "‘"]);

export function segmentSentences(text: string): SentenceUnit[] {
  const units: SentenceUnit[] = [];
  let unitStart = -1;

  const push = (end: number) => {
    if (unitStart === -1) return;
    let trimmedEnd = end;
    while (trimmedEnd > unitStart && isSpace(text[trimmedEnd - 1])) trimmedEnd--;
    if (trimmedEnd > unitStart) {
      units.push({
        id: `u${units.length + 1}`,
        start: unitStart,
        end: trimmedEnd,
        text: text.slice(unitStart, trimmedEnd),
      });
    }
    unitStart = -1;
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\n" || ch === "\r") {
      push(i);
      i++;
      continue;
    }

    if (unitStart === -1) {
      if (!isSpace(ch)) unitStart = i;
      i++;
      continue;
    }

    if (ch === "." || ch === "!" || ch === "?") {
      let end = i + 1;
      while (end < text.length && (text[end] === "." || text[end] === "!" || text[end] === "?")) end++;
      while (end < text.length && CLOSERS.has(text[end])) end++;

      if (ch === "." && isAbbreviation(text, unitStart, i)) {
        i = end;
        continue;
      }

      let next = end;
      while (next < text.length && (text[next] === " " || text[next] === "\t")) next++;
      const atLineEnd = next >= text.length || text[next] === "\n" || text[next] === "\r";
      if (atLineEnd || (next > end && startsSentence(text[next]))) {
        push(end);
        i = end;
        continue;
      }
      i = end;
      continue;
    }

    i++;
  }
  push(text.length);
  return units;
}

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f" || ch === "\v" || ch === " ";
}

function startsSentence(ch: string): boolean {
  return /[A-Z0-9]/.test(ch) || OPENERS.has(ch);
}

/** The word ending at `periodIndex` (exclusive), lower-cased, compared to known abbreviations. */
function isAbbreviation(text: string, unitStart: number, periodIndex: number): boolean {
  let wordStart = periodIndex;
  while (wordStart > unitStart && /[A-Za-z.]/.test(text[wordStart - 1])) wordStart--;
  const word = text.slice(wordStart, periodIndex).toLowerCase();
  if (word === "") return false;
  if (ABBREVIATIONS.has(word)) return true;
  // Dotted letters such as "U.S.A" or "a.m". A lone capital ("Schedule A.") is not treated as an
  // initial, because a sentence ending there must still end the unit.
  return /^([a-z]\.)+[a-z]$/.test(word);
}
