"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AnalyseFailureCode, AnalyseRequestBody, AnalyseResponseBody } from "../../../lib/analysis/api";
import type { AnalysisResult, SeverityBand } from "../../../lib/analysis/types";
import styles from "../app.module.css";

type FailureReason = AnalyseFailureCode | "not-txt" | "empty-file" | "unreadable-file" | "offline";

type Screen =
  | { state: "idle" }
  | { state: "extracting"; fileName: string }
  | { state: "analysing"; fileName: string }
  | { state: "result"; fileName: string; result: AnalysisResult }
  | { state: "failed"; fileName: string | null; reason: FailureReason };

const FAILURE_COPY: Record<FailureReason, string> = {
  "not-txt": "This version only reads .txt files.",
  "empty-file": "That file has no text in it.",
  "unreadable-file": "Your browser couldn't read that file. Try choosing it again.",
  offline: "Couldn't reach Redline. Check your connection and try again.",
  "bad-request": "The document text didn't reach the server intact. Try again.",
  "not-configured": "Analysis isn't set up on this server yet.",
  citation:
    "The analysis quoted a sentence that doesn't match your document word for word, so none of it is shown. Try again.",
  "model-unavailable": "The analysis service didn't return a usable answer. Try again in a minute.",
  unexpected: "Something went wrong during the analysis. Try again.",
};

const SEVERITY_COPY: Record<SeverityBand, string> = {
  high: "Could cost you money with no ceiling",
  medium: "Hard or impossible to get out of",
};

export default function AnalysePage() {
  const [screen, setScreen] = useState<Screen>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = screen.state === "extracting" || screen.state === "analysing";

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const fileName = file.name;
    if (!/\.txt$/i.test(fileName) && file.type !== "text/plain") {
      setScreen({ state: "failed", fileName, reason: "not-txt" });
      return;
    }

    setScreen({ state: "extracting", fileName });
    let text: string;
    try {
      text = await file.text();
    } catch {
      setScreen({ state: "failed", fileName, reason: "unreadable-file" });
      return;
    }
    if (text.trim() === "") {
      setScreen({ state: "failed", fileName, reason: "empty-file" });
      return;
    }

    setScreen({ state: "analysing", fileName });
    const body: AnalyseRequestBody = { text, redLines: [] };
    let response: Response;
    try {
      response = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setScreen({ state: "result", fileName, result: payload.result });
    } else {
      const code = "code" in payload && payload.code in FAILURE_COPY ? payload.code : "unexpected";
      setScreen({ state: "failed", fileName, reason: code });
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.intake} aria-labelledby="intake-heading">
        <h1 id="intake-heading" className={styles.heading}>
          Check a document
        </h1>
        <p className={styles.lede}>
          Pick a .txt file. Your browser reads it here and sends Redline only the text.
        </p>
        <input
          ref={inputRef}
          id="document-file"
          className={styles.fileInput}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFile}
          disabled={busy}
        />
        <label htmlFor="document-file" className={styles.fileButton} data-disabled={busy || undefined}>
          {screen.state === "idle" ? "Choose a .txt file" : "Choose another file"}
        </label>
      </section>

      <section className={styles.outcome} aria-live="polite">
        {screen.state === "idle" && <p className={styles.quiet}>No document yet.</p>}

        {busy && (
          <p className={styles.status} role="status">
            <span className={styles.pulse} aria-hidden="true" />
            {screen.state === "extracting"
              ? `Reading ${screen.fileName}…`
              : `Checking ${screen.fileName}. This can take a minute.`}
          </p>
        )}

        {screen.state === "failed" && (
          <div className={styles.failure} role="alert">
            <h2 className={styles.failureHeading}>The analysis failed</h2>
            <p className={styles.failureText}>{FAILURE_COPY[screen.reason]}</p>
            <button type="button" className={styles.textButton} onClick={() => inputRef.current?.click()}>
              Choose a file
            </button>
          </div>
        )}

        {screen.state === "result" && <RiskFlagList fileName={screen.fileName} result={screen.result} />}
      </section>
    </div>
  );
}

function RiskFlagList({ fileName, result }: { fileName: string; result: AnalysisResult }) {
  const count = result.riskFlags.length;
  return (
    <div>
      <h2 className={styles.listHeading}>
        {count === 0
          ? `No risk flags in ${fileName}`
          : `${count} risk ${count === 1 ? "flag" : "flags"} in ${fileName}, most likely to cost you first`}
      </h2>
      {count === 0 ? (
        <p className={styles.quiet}>
          No sentence in this document puts an uncapped cost on you or locks you in with no way out.
        </p>
      ) : (
        <ol className={styles.flags}>
          {result.riskFlags.map((flag) => (
            <li key={`${flag.rank}-${flag.source.start}`} className={styles.flag}>
              <span className={styles.tip} aria-label={`Rank ${flag.rank}`}>
                {flag.rank}
              </span>
              <div className={styles.flagBody}>
                <h3 className={styles.flagTitle}>{flag.title}</h3>
                <p className={styles.severity}>{SEVERITY_COPY[flag.severityBand]}</p>
                <ul className={styles.claims}>
                  {flag.claims.map((claim, index) =>
                    claim.tier === "inference" ? (
                      <li key={index} className={styles.claim} data-tier="inference">
                        <span className={styles.inferenceLabel}>Inference</span> {claim.text}
                      </li>
                    ) : (
                      <li key={index} className={styles.claim} data-tier="read-off">
                        {claim.text}
                      </li>
                    ),
                  )}
                </ul>
                <blockquote className={styles.quote}>
                  <p>“{flag.source.text}”</p>
                </blockquote>
                <p className={styles.meta}>Quoted word for word from your document</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
