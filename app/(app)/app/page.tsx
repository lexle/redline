"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { AnalyseFailureCode, AnalyseResponseBody } from "../../../lib/analysis/api";
import { buildAnalyseRequestBody, isBlankDocument } from "../../../lib/analysis/request";
import { countParts } from "../../../lib/analysis/parts";
import { redLinesForAnalysis } from "../../../lib/red-lines/store";
import { getSupabaseClient } from "../../../lib/supabase/client";
import { ExtractionError, documentFormat, extractText } from "../../../lib/extraction/extract-text";
import type { Extraction, ExtractionErrorCode } from "../../../lib/extraction/extract-text";
import type { AnalysisResult, RedLine } from "../../../lib/analysis/types";
import { buildSavedDocument, titleForDocument } from "../../../lib/library/payload";
import { saveForSignedInSigner } from "../../../lib/library/store";
import styles from "../app.module.css";
import { ResultView } from "./ResultView";
import { SaveNotice } from "./SaveNotice";
import type { SaveState } from "./SaveNotice";

type FailureReason = AnalyseFailureCode | ExtractionErrorCode | "empty-file" | "offline" | "red-lines";

type Screen =
  | { state: "idle" }
  | { state: "extracting"; fileName: string }
  | { state: "analysing"; fileName: string; parts: number }
  | { state: "scan"; fileName: string; format: "pdf" | "docx" }
  | { state: "result"; fileName: string; text: string; result: AnalysisResult; redLineCount: number }
  | { state: "failed"; fileName: string | null; reason: FailureReason };

const FAILURE_COPY: Record<FailureReason, string> = {
  "unsupported-type": "Redline reads .txt, PDF and Word (.docx) files. Choose one of those, or paste the text.",
  "invalid-pdf": "This PDF won't open. It may be damaged or password protected.",
  "invalid-docx": "This Word file won't open. It may be damaged or password protected.",
  "empty-file": "That file has no text in it.",
  "unreadable-file": "Your browser couldn't read that file. Try choosing it again.",
  offline: "Couldn't reach Redline. Check your connection and try again.",
  "red-lines": "Your red lines didn't load, so nothing was checked. Try again.",
  "bad-request": "The document text didn't reach the server intact. Try again.",
  "not-configured": "Analysis isn't set up on this server yet.",
  citation:
    "The analysis quoted a sentence that doesn't match your document word for word, so none of it is shown. Try again.",
  "model-unavailable": "The analysis service didn't return a usable answer. Try again in a minute.",
  unexpected: "Something went wrong during the analysis. Try again.",
};


const EXTRACTION_FAILURES: readonly FailureReason[] = ["unsupported-type", "invalid-pdf", "invalid-docx", "unreadable-file", "empty-file"];

function isExtractionFailure(reason: FailureReason): boolean {
  return EXTRACTION_FAILURES.includes(reason);
}

/** How the result screen names a Document the Signer pasted rather than read from a file. */
export const PASTED_DOCUMENT_NAME = "your pasted document";

export default function AnalysePage() {
  const [screen, setScreen] = useState<Screen>({ state: "idle" });
  const [pasted, setPasted] = useState("");
  const [pasteRefused, setPasteRefused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = screen.state === "extracting" || screen.state === "analysing";
  const [save, setSave] = useState<SaveState>({ state: "not-configured" });
  /** Counts results, so a slow save from an earlier result never overwrites the current one's state. */
  const saveRun = useRef(0);

  /**
   * Keeps a signed-in Signer's result in their library. The result is already on screen and stays
   * there whatever happens here; a failed save only changes the quiet line under the summary.
   */
  async function saveResult(
    supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
    run: number,
    fileName: string,
    text: string,
    result: AnalysisResult,
  ) {
    let next: SaveState;
    try {
      const outcome = await saveForSignedInSigner(supabase, buildSavedDocument(titleForDocument(fileName), text, result));
      next = outcome.state === "saved" ? { state: "saved", id: outcome.id } : { state: "signed-out" };
    } catch (error) {
      console.error("[library]", error instanceof Error ? error.message : error);
      next = { state: "failed" };
    }
    if (run === saveRun.current) setSave(next);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const fileName = file.name;
    setScreen({ state: "extracting", fileName });
    // Only the extracted text leaves the browser. The file itself is never sent.
    let extraction: Extraction;
    try {
      extraction = await extractText(file);
    } catch (error) {
      const reason = error instanceof ExtractionError ? error.code : "unreadable-file";
      setScreen({ state: "failed", fileName, reason });
      return;
    }
    if (extraction.kind === "no-text") {
      setScreen({ state: "scan", fileName, format: documentFormat(file) === "docx" ? "docx" : "pdf" });
      return;
    }
    const text = extraction.text;
    if (isBlankDocument(text)) {
      setScreen({ state: "failed", fileName, reason: "empty-file" });
      return;
    }
    setPasteRefused(false);
    await runAnalysis(text, fileName);
  }

  async function handlePaste(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The textarea's value is sent exactly as the browser hands it over.
    const text = pasted;
    if (isBlankDocument(text)) {
      setPasteRefused(true);
      return;
    }
    setPasteRefused(false);
    await runAnalysis(text, PASTED_DOCUMENT_NAME);
  }

  async function runAnalysis(text: string, fileName: string) {
    setScreen({ state: "analysing", fileName, parts: countParts(text) });
    // A signed-in Signer's red lines go with every analysis; signed out, or with accounts not set
    // up, it runs with none. If they fail to load, nothing is checked: a result run without them
    // would look like one run with them.
    let redLines: RedLine[] = [];
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        redLines = await redLinesForAnalysis(supabase);
      } catch (error) {
        console.error("[red-lines]", error instanceof Error ? error.message : error);
        setScreen({ state: "failed", fileName, reason: "red-lines" });
        return;
      }
    }
    let response: Response;
    try {
      response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildAnalyseRequestBody(text, redLines),
      });
    } catch {
      setScreen({ state: "failed", fileName, reason: "offline" });
      return;
    }

    let payload: AnalyseResponseBody;
    try {
      payload = (await response.json()) as AnalyseResponseBody;
    } catch {
      setScreen({ state: "failed", fileName, reason: "unexpected" });
      return;
    }
    if ("result" in payload && payload.ok && response.ok) {
      const result = payload.result;
      const run = ++saveRun.current;
      setSave(supabase ? { state: "checking" } : { state: "not-configured" });
      setScreen({ state: "result", fileName, text, result, redLineCount: redLines.length });
      if (supabase) void saveResult(supabase, run, fileName, text, result);
    } else {
      const code = "code" in payload && payload.code in FAILURE_COPY ? payload.code : "unexpected";
      setScreen({ state: "failed", fileName, reason: code });
    }
  }

  return (
    <div className={styles.workspace} data-result={screen.state === "result" || undefined}>
      <section className={styles.intake} aria-labelledby="intake-heading">
        <h1 id="intake-heading" className={styles.heading}>
          Check a document
        </h1>
        <p className={styles.lede}>
          Pick a .txt, PDF or Word (.docx) file, or paste the text. Your browser sends Redline only the text.
        </p>
        <input
          ref={inputRef}
          id="document-file"
          className={styles.fileInput}
          type="file"
          accept=".txt,text/plain,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFile}
          disabled={busy}
        />
        <label htmlFor="document-file" className={styles.fileButton} data-disabled={busy || undefined}>
          {screen.state === "idle" ? "Choose a .txt, PDF or Word file" : "Choose another file"}
        </label>

        <form className={styles.paste} onSubmit={handlePaste} noValidate>
          <label htmlFor="document-paste" className={styles.pasteLabel}>
            Or paste the text
          </label>
          <textarea
            id="document-paste"
            className={styles.pasteInput}
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value);
              if (pasteRefused) setPasteRefused(false);
            }}
            rows={8}
            spellCheck={false}
            disabled={busy}
            aria-invalid={pasteRefused || undefined}
            aria-describedby={pasteRefused ? "document-paste-error" : undefined}
          />
          {pasteRefused && (
            <p id="document-paste-error" className={styles.pasteError} role="alert">
              There's no text to check. Paste the document first.
            </p>
          )}
          <button type="submit" className={styles.pasteButton} disabled={busy}>
            Check this text
          </button>
        </form>
      </section>

      {screen.state === "result" ? (
        <ResultView
          fileName={screen.fileName}
          text={screen.text}
          result={screen.result}
          redLineCount={screen.redLineCount}
          notice={<SaveNotice save={save} />}
        />
      ) : (
      <section className={styles.outcome} aria-live="polite">
        {screen.state === "idle" && <p className={styles.quiet}>No document yet.</p>}

        {busy && (
          <p className={styles.status} role="status">
            <span className={styles.pulse} aria-hidden="true" />
            {screen.state === "extracting"
              ? `Reading ${screen.fileName}…`
              : screen.parts > 1
                ? `Checking ${screen.fileName}. It's long, so Redline reads it in ${screen.parts} parts and shows nothing until every part is done. This can take a few minutes.`
                : `Checking ${screen.fileName}. This can take a minute.`}
          </p>
        )}

        {screen.state === "scan" && (
          <div className={styles.failure} role="alert">
            {screen.format === "docx" ? (
              <>
                <h2 className={styles.failureHeading}>No text in this Word file</h2>
                <p className={styles.failureText}>
                  Redline can&apos;t read {screen.fileName}. It has pictures or blank space but no text, so nothing
                  was checked. If it&apos;s a picture of a page, paste the text or choose a copy with typed text.
                </p>
              </>
            ) : (
              <>
                <h2 className={styles.failureHeading}>This looks like a scan</h2>
                <p className={styles.failureText}>
                  Redline can&apos;t read {screen.fileName}. At least one page is an image with no text in it, so
                  nothing was checked. Choose a copy with text you can select, or paste the text.
                </p>
              </>
            )}
            <button type="button" className={styles.textButton} onClick={() => inputRef.current?.click()}>
              Choose a file
            </button>
          </div>
        )}

        {screen.state === "failed" && (
          <div className={styles.failure} role="alert">
            <h2 className={styles.failureHeading}>
              {isExtractionFailure(screen.reason) ? "Couldn't read this file" : "The analysis failed"}
            </h2>
            <p className={styles.failureText}>{FAILURE_COPY[screen.reason]}</p>
            <button type="button" className={styles.textButton} onClick={() => inputRef.current?.click()}>
              Choose a file
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
}

