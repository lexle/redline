"use client";

import { useState } from "react";
import type { SourceSentence } from "../../../lib/analysis/types";
import styles from "../app.module.css";

/** Source sentences shown on request, in Tinos and in quotes: the Document's own words. */
export function SourceReveal({ id, sources }: { id: string; sources: readonly SourceSentence[] }) {
  const [open, setOpen] = useState(false);
  const many = sources.length > 1;
  return (
    <>
      <button
        type="button"
        className={styles.sourceToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {open
          ? many ? "Hide the quotes" : "Hide the quote"
          : many ? `Show the ${sources.length} quotes it rests on` : "Show the quote it rests on"}
      </button>
      <div id={id} hidden={!open}>
        {sources.map((source) => (
          <blockquote key={source.start} className={styles.quote}>
            <p>“{source.text}”</p>
          </blockquote>
        ))}
        <p className={styles.meta}>Quoted word for word from your document</p>
      </div>
    </>
  );
}
