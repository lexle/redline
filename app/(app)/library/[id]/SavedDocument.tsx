"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CitationError, reopenSavedDocument, StoredDocumentError } from "../../../../lib/library/reopen";
import type { ReopenedDocument } from "../../../../lib/library/reopen";
import styles from "../../app.module.css";
import { ResultView } from "../../app/ResultView";
import { formatSavedDate } from "../copy";

type Reopened = { state: "ok"; document: ReopenedDocument } | { state: "citation" } | { state: "malformed" };

function reopen(row: unknown): Reopened {
  try {
    return { state: "ok", document: reopenSavedDocument(row) };
  } catch (error) {
    console.error("[library]", error instanceof Error ? error.message : error);
    if (error instanceof CitationError) return { state: "citation" };
    if (error instanceof StoredDocumentError) return { state: "malformed" };
    throw error;
  }
}

/**
 * A saved Document, reopened from its stored row. Every cited span is checked again against the
 * stored text first. If any check fails, only the failure is shown: no summary, no flags, no page.
 */
export function SavedDocument({ row }: { row: unknown }) {
  const reopened = useMemo(() => reopen(row), [row]);

  if (reopened.state !== "ok") {
    return (
      <div className={styles.formPage}>
        <div className={styles.failure} role="alert">
          <h1 className={styles.failureHeading}>This saved document can&apos;t be shown</h1>
          <p className={styles.failureText}>
            {reopened.state === "citation"
              ? "At least one quote in the saved results no longer matches the saved text word for word, so none of it is shown."
              : "The saved results are damaged or incomplete, so none of it is shown."}{" "}
            Check the document again to get a new result.
          </p>
          <p className={styles.linkRow}>
            <Link href="/app" className={styles.textLink}>
              Check a document
            </Link>
            <Link href="/library" className={styles.textLink}>
              Back to library
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { document } = reopened;
  return (
    <div className={styles.savedDocument}>
      <header className={styles.savedHead}>
        <Link href="/library" className={styles.inlineLink}>
          Library
        </Link>
        <h1 className={styles.heading}>{document.title}</h1>
        <p className={styles.meta}>Saved {formatSavedDate(document.createdAt)}</p>
      </header>
      <ResultView fileName={document.title} text={document.text} result={document.result} redLineCount={0} />
    </div>
  );
}
