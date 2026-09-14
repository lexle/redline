/**
 * Splits the stored Document text into contiguous segments for display, marking which cited spans
 * each segment belongs to. Highlights are placed from offsets alone: this never searches the text,
 * so a sentence that appears twice is highlighted only at the occurrence its offsets point at.
 */

/** A cited stretch of the stored text, `[start, end)` in UTF-16 offsets, as `SourceSentence` has. */
export interface CitedSpan {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

export interface DocumentSegment {
  readonly start: number;
  readonly end: number;
  /** `text.slice(start, end)`, exactly. */
  readonly text: string;
  /** The ids of every span that covers this whole segment, in the order the spans were given. */
  readonly spanIds: readonly string[];
}

/** Thrown for a span whose offsets do not fit the stored text. */
export class SpanRangeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "SpanRangeError";
  }
}

/**
 * Returns segments that cover `text` exactly once, in order: concatenating their `text` fields gives
 * back `text` unchanged. Segment boundaries fall at 0, `text.length` and every span's start and end,
 * so overlapping or adjacent spans split into pieces that neither repeat nor drop a character. An
 * empty span (start === end) covers no segment. Throws `SpanRangeError` for any span with a
 * non-integer offset, an offset outside the text, or start > end.
 */
export function segmentDocument(text: string, spans: readonly CitedSpan[]): DocumentSegment[] {
  const invalid = spans.filter(
    (span) =>
      !Number.isInteger(span.start) ||
      !Number.isInteger(span.end) ||
      span.start < 0 ||
      span.end > text.length ||
      span.start > span.end,
  );
  if (invalid.length > 0) {
    const listed = invalid.map((span) => `${span.id} [${span.start}, ${span.end})`).join(", ");
    throw new SpanRangeError(`Spans do not fit a text of length ${text.length}: ${listed}.`);
  }

  const boundaries = new Set<number>([0, text.length]);
  for (const span of spans) {
    boundaries.add(span.start);
    boundaries.add(span.end);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: DocumentSegment[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const spanIds = spans.filter((span) => span.start <= start && span.end >= end).map((span) => span.id);
    segments.push({ start, end, text: text.slice(start, end), spanIds });
  }
  return segments;
}
