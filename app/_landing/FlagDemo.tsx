"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { agreementTitle, clauses, flags, preamble, splitClause } from "./sample-agreement";
import styles from "./landing.module.css";

const TAB_SPACING = 30;
const flaggedClauses = flags.map((flag) => flag.clause);
const cropFrom = Math.min(...flaggedClauses);
const cropTo = Math.max(...flaggedClauses);

export function FlagDemo() {
  const [active, setActive] = useState(1);
  const [tabTops, setTabTops] = useState<Record<number, number> | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef(new Map<number, HTMLElement>());

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const measure = () => {
      const pageTop = page.getBoundingClientRect().top;
      const lines = flags
        .map((flag) => {
          const firstLine = markRefs.current.get(flag.rank)?.getClientRects()[0];
          return {
            rank: flag.rank,
            top: firstLine ? firstLine.top - pageTop + firstLine.height / 2 : 0,
          };
        })
        .sort((a, b) => a.top - b.top);

      const tops: Record<number, number> = {};
      let previous = -Infinity;
      for (const line of lines) {
        const top = Math.max(line.top, previous + TAB_SPACING);
        tops[line.rank] = top;
        previous = top;
      }
      setTabTops(tops);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <figure className={styles.stage}>
        <div ref={pageRef} className={styles.page} data-ready={tabTops ? "" : undefined}>
          <p className={styles.runningHead}>
            <span>Sample</span>
            <span>Page 1</span>
          </p>
          <p className={styles.docTitle} data-crop="out">
            {agreementTitle}
          </p>
          <p className={styles.clause} data-crop="out">
            {preamble}
          </p>
          {clauses.map((clause) => {
            const { before, flag, after } = splitClause(clause);
            const outsideCrop = clause.number < cropFrom || clause.number > cropTo;
            return (
              <p
                key={clause.number}
                className={styles.clause}
                data-crop={outsideCrop ? "out" : undefined}
              >
                <span className={styles.clauseHead}>
                  {clause.number}. {clause.heading}.
                </span>{" "}
                {before}
                {flag && (
                  <mark
                    ref={(element) => {
                      if (element) markRefs.current.set(flag.rank, element);
                      else markRefs.current.delete(flag.rank);
                    }}
                    className={styles.mark}
                    data-active={flag.rank === active || undefined}
                  >
                    {flag.sentence}
                  </mark>
                )}
                {after}
              </p>
            );
          })}
          <span className={styles.cutEdge} aria-hidden="true" />
          {tabTops &&
            flags.map((flag, index) => (
              <span
                key={flag.rank}
                aria-hidden="true"
                className={styles.tab}
                data-active={flag.rank === active || undefined}
                style={{ "--y": `${tabTops[flag.rank]}px`, "--i": index } as CSSProperties}
                onClick={() => setActive(flag.rank)}
              >
                <span className={styles.tabClear} />
                <span className={styles.tabTip}>{flag.rank}</span>
              </span>
            ))}
        </div>
        <figcaption className={styles.caption}>
          A sample agreement, written for this page.
          <span className={styles.cropNote}>
            {" "}
            Sections {cropFrom} to {cropTo} shown.
          </span>
        </figcaption>
      </figure>

      <section className={styles.ranked} aria-labelledby="ranked-heading">
        <h2 id="ranked-heading" className={styles.rankedHeading}>
          Three flags, ranked by what&rsquo;s likely to cost you
        </h2>
        <ol className={styles.flags}>
          {flags.map((flag) => {
            const isActive = flag.rank === active;
            return (
              <li
                key={flag.rank}
                className={styles.flag}
                data-active={isActive || undefined}
                onClick={() => setActive(flag.rank)}
              >
                <span className={styles.tip} aria-hidden="true">
                  {flag.rank}
                </span>
                <div className={styles.flagBody}>
                  <button
                    type="button"
                    className={styles.flagTitle}
                    aria-expanded={isActive}
                    aria-disabled={isActive || undefined}
                    aria-controls={`flag-${flag.rank}-detail`}
                  >
                    <span className={styles.visuallyHidden}>Flag {flag.rank}: </span>
                    {flag.title}
                  </button>
                  <blockquote className={styles.quote}>&ldquo;{flag.sentence}&rdquo;</blockquote>
                  <div id={`flag-${flag.rank}-detail`} className={styles.detail} hidden={!isActive}>
                    <p>{flag.plain}</p>
                    <p className={styles.meta}>Quoted word for word from section {flag.clause}.</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className={styles.afterList}>
          Each flag also comes with wording you can send back to the client.
        </p>
      </section>
    </>
  );
}
