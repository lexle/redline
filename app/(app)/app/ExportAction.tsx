"use client";

import { useState } from "react";
import type { AnalysisResult } from "../../../lib/analysis/types";
import { buildMarkedUpCopy, markedUpCopyFileName } from "../../../lib/export/marked-up-copy";
import styles from "../app.module.css";

/**
 * Saves the marked-up copy as a plain-text file. The file is made in the browser from the text and
 * result already on screen; nothing is sent anywhere.
 */
export function ExportAction({ fileName, text, result }: { fileName: string; text: string; result: AnalysisResult }) {
  const [failed, setFailed] = useState(false);

  function download() {
    let copy: string;
    try {
      copy = buildMarkedUpCopy(text, result, fileName);
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    const url = URL.createObjectURL(new Blob([copy], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = markedUpCopyFileName(fileName);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className={styles.export} aria-labelledby="export-heading">
      <h2 id="export-heading" className={styles.listHeading}>
        Marked-up copy
      </h2>
      <p className={styles.exportText}>
        A plain-text copy of the document with each proposed replacement next to its clause and the proposed
        insertions at the end. Your browser makes the file, so nothing is uploaded.
      </p>
      <button type="button" className={styles.exportButton} onClick={download}>
        Download marked-up copy
      </button>
      {failed && (
        <p className={styles.pasteError} role="alert">
          Couldn&apos;t make the copy. A risk flag doesn&apos;t match the document text, so nothing was downloaded.
        </p>
      )}
    </section>
  );
}
