"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AnalysisResult, MultiplierNote, RiskFlag, WorthALook } from "../../../lib/analysis/types";
import { segmentDocument } from "../../../lib/document/segments";
import styles from "../app.module.css";

/** Tabs are 24px tall; a crowded tab moves down rather than overlapping (DESIGN.md, Tab placement). */
const TAB_SPACING = 30;

export const DOCUMENT_PAGE_ID = "document-page";

export function riskFlagMarkId(flag: RiskFlag): string {
  return `risk-flag-${flag.rank}`;
}

export function worthALookMarkId(index: number): string {
  return `worth-a-look-${index}`;
}

export function multiplierNoteMarkId(index: number): string {
  return `multiplier-note-${index}`;
}

type MarkKind = "flag" | "quiet";

interface PageMark {
  readonly id: string;
  readonly kind: MarkKind;
  readonly start: number;
  readonly end: number;
  /** Risk flags only: the numeral on its tab. */
  readonly rank?: number;
}

/**
 * Only cited findings go on the page: Risk flags with a tab and tape, Worth a look and Multiplier
 * notes with a quieter highlight when selected. Missing protections and Nice to have cite nothing,
 * so they are never read here.
 */
function marksFor(result: AnalysisResult): PageMark[] {
  return [
    ...result.riskFlags.map((flag): PageMark => ({
      id: riskFlagMarkId(flag),
      kind: "flag",
      start: flag.source.start,
      end: flag.source.end,
      rank: flag.rank,
    })),
    ...result.worthALook.map((entry: WorthALook, index): PageMark => ({
      id: worthALookMarkId(index),
      kind: "quiet",
      start: entry.source.start,
      end: entry.source.end,
    })),
    ...result.multiplierNotes.map((entry: MultiplierNote, index): PageMark => ({
      id: multiplierNoteMarkId(index),
      kind: "quiet",
      start: entry.source.start,
      end: entry.source.end,
    })),
  ];
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The stored Document text as a page, displayed exactly as stored. Highlights come from the
 * validated offsets through `segmentDocument`; nothing here searches the text. Tabs are pointer
 * mirrors of the ranked list and hidden from assistive technology.
 */
export function DocumentView({
  fileName,
  text,
  result,
  pulled,
  scrollRequest,
  onPull,
}: {
  fileName: string;
  text: string;
  result: AnalysisResult;
  /** The one selected mark id, or null. */
  pulled: string | null;
  /** Changes each time the Signer selects something, so the page scrolls only when asked to. */
  scrollRequest: number;
  onPull: (id: string) => void;
}) {
  const marks = useMemo(() => marksFor(result), [result]);
  const segments = useMemo(() => segmentDocument(text, marks), [text, marks]);
  const kinds = useMemo(() => new Map(marks.map((mark) => [mark.id, mark.kind])), [marks]);
  const flagMarks = marks.filter((mark) => mark.kind === "flag");

  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  /** The first rendered segment of each mark, which holds the first line of its sentence. */
  const firstSegments = useRef(new Map<string, HTMLElement>());
  const [tabTops, setTabTops] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const measure = () => {
      const pageTop = page.getBoundingClientRect().top;
      const lines = flagMarks
        .map((mark) => {
          const element = firstSegments.current.get(mark.id);
          const firstLine = element?.getClientRects()[0] ?? element?.getBoundingClientRect();
          return { id: mark.id, top: firstLine ? firstLine.top - pageTop + firstLine.height / 2 : 0 };
        })
        .sort((a, b) => a.top - b.top);

      const tops: Record<string, number> = {};
      let previous = -Infinity;
      for (const line of lines) {
        const top = Math.max(line.top, previous + TAB_SPACING);
        tops[line.id] = top;
        previous = top;
      }
      setTabTops(tops);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
    // flagMarks is derived from marks, so measuring again when marks change covers it.
  }, [marks, text]);

  useLayoutEffect(() => {
    if (scrollRequest === 0 || pulled === null) return;
    const scroller = scrollerRef.current;
    const target = firstSegments.current.get(pulled);
    if (!scroller || !target) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

    const offset = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (typeof scroller.scrollTo === "function") {
      scroller.scrollTo({ top: scroller.scrollTop + offset - scroller.clientHeight / 3, behavior });
    }
    // Stacked on a phone, the page may be off screen: bring the page itself into view too.
    const bounds = scroller.getBoundingClientRect();
    if ((bounds.top < 0 || bounds.bottom > window.innerHeight) && typeof scroller.scrollIntoView === "function") {
      scroller.scrollIntoView({ block: "nearest", behavior });
    }
  }, [scrollRequest, pulled]);

  const seen = new Set<string>();
  const pulledKind = pulled === null ? undefined : kinds.get(pulled);

  return (
    <section className={styles.documentColumn} aria-labelledby="document-heading">
      <h2 id="document-heading" className={styles.listHeading}>
        Full text of {fileName}
      </h2>
      <div ref={scrollerRef} className={styles.pageScroller}>
        <div ref={pageRef} className={styles.docPage}>
          <div id={DOCUMENT_PAGE_ID} className={styles.docText} data-document-text="">
            {segments.map((segment) => {
              if (segment.spanIds.length === 0) return segment.text;
              const firstFor = segment.spanIds.filter((id) => !seen.has(id));
              for (const id of firstFor) seen.add(id);
              const flagged = segment.spanIds.some((id) => kinds.get(id) === "flag");
              const isPulled = pulled !== null && segment.spanIds.includes(pulled);
              return (
                <mark
                  key={segment.start}
                  ref={(element) => {
                    for (const id of firstFor) {
                      if (element) firstSegments.current.set(id, element);
                      else firstSegments.current.delete(id);
                    }
                  }}
                  className={styles.docMark}
                  data-start={segment.start}
                  data-end={segment.end}
                  data-spans={segment.spanIds.join(" ")}
                  data-flagged={flagged || undefined}
                  data-pulled={isPulled ? pulledKind : undefined}
                >
                  {segment.text}
                </mark>
              );
            })}
          </div>
          {flagMarks.map((mark) => (
            <span
              key={mark.id}
              aria-hidden="true"
              className={styles.pageTab}
              data-mark={mark.id}
              data-rank={mark.rank}
              data-pulled={mark.id === pulled || undefined}
              style={{ "--y": `${tabTops[mark.id] ?? 0}px` } as CSSProperties}
              onClick={() => onPull(mark.id)}
            >
              <span className={styles.pageTabClear} />
              <span className={styles.pageTabTip} data-rank={mark.rank} />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
