"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AnalyseFailureCode, AnalyseRequestBody, AnalyseResponseBody } from "../../../lib/analysis/api";
import type {
  AnalysisResult,
  Claim,
  InferenceClaim,
  MissingProtection,
  MultiplierNote,
  ProtectionKind,
  SeverityBand,
  SummarySentence,
  WorthALook,
} from "../../../lib/analysis/types";
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

const PROTECTION_COPY: Record<ProtectionKind, string> = {
  "payment-timing": "When you get paid",
  "payment-amount": "How much you get paid",
  "kill-fee": "Pay for work done if the job ends early",
  "late-payment-remedy": "What happens if you're paid late",
  "scope-revision-limits": "Limits on revisions and extra work",
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

        {screen.state === "result" && (
          <>
            <SummarySection fileName={screen.fileName} sentences={screen.result.summary} />
            <RiskFlagList fileName={screen.fileName} result={screen.result} />
            <MissingProtectionList fileName={screen.fileName} entries={screen.result.missingProtections} />
            <UnrankedSection
              heading="Worth a look"
              explainer="These clauses are one-sided or unusual, but each has a limit and a way out, so they aren’t ranked with the risk flags."
              empty="Nothing for Worth a look in this document."
              entries={screen.result.worthALook}
            />
            <UnrankedSection
              heading="Multiplier notes"
              explainer="These clauses make things harder for you if something else in the agreement goes wrong. On their own they cost you nothing, so they aren’t ranked with the risk flags."
              empty="No multiplier notes in this document."
              entries={screen.result.multiplierNotes}
            />
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The plain-English summary (ADR-0010), first in the result. Each sentence is Redline's words, so
 * Archivo; its Source sentences are the Document's words, so Tinos in quotes, shown on request.
 */
function SummarySection({ fileName, sentences }: { fileName: string; sentences: readonly SummarySentence[] }) {
  return (
    <section className={styles.summary} aria-labelledby="summary-heading">
      <h2 id="summary-heading" className={styles.listHeading}>
        Summary of {fileName}
      </h2>
      <ol className={styles.summaryList}>
        {sentences.map((sentence, index) => (
          <SummaryItem key={`${index}-${sentence.sources[0].start}`} sentence={sentence} index={index} />
        ))}
      </ol>
    </section>
  );
}

function SummaryItem({ sentence, index }: { sentence: SummarySentence; index: number }) {
  const [open, setOpen] = useState(false);
  const sourcesId = `summary-sources-${index}`;
  const many = sentence.sources.length > 1;
  return (
    <li className={styles.summaryItem}>
      <p className={styles.summaryText}>
        {sentence.tier === "inference" && <span className={styles.inferenceLabel}>Inference</span>}{" "}
        {sentence.text}
      </p>
      <button
        type="button"
        className={styles.sourceToggle}
        aria-expanded={open}
        aria-controls={sourcesId}
        onClick={() => setOpen((value) => !value)}
      >
        {open
          ? many ? "Hide the quotes" : "Hide the quote"
          : many ? `Show the ${sentence.sources.length} quotes it rests on` : "Show the quote it rests on"}
      </button>
      <div id={sourcesId} hidden={!open}>
        {sentence.sources.map((source) => (
          <blockquote key={source.start} className={styles.quote}>
            <p>“{source.text}”</p>
          </blockquote>
        ))}
        <p className={styles.meta}>Quoted word for word from your document</p>
      </div>
    </li>
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
                <ClaimList claims={flag.claims} />
                <blockquote className={styles.quote}>
                  <p>“{flag.source.text}”</p>
                </blockquote>
                <p className={styles.meta}>Quoted word for word from your document</p>
                <CounterOffer text={flag.counterOffer} idSuffix={String(flag.rank)} heading="Counter-offer" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Missing protections (ADR-0005): their own list, never merged into the ranking. Each is an outlined
 * flag with no line under it: no rank tip, no magenta fill, no Source sentence, because it cites
 * nothing. Its Proposed insertion reuses the Counter-offer box.
 */
function MissingProtectionList({ fileName, entries }: { fileName: string; entries: readonly MissingProtection[] }) {
  const count = entries.length;
  return (
    <div className={styles.missing}>
      <h2 className={styles.listHeading}>
        {count === 0
          ? `No missing protections in ${fileName}`
          : `${fileName} leaves out ${count} ${count === 1 ? "protection" : "protections"}`}
      </h2>
      {count === 0 ? (
        <p className={styles.quiet}>
          Your document covers when and how much you&rsquo;re paid, pay for work done if the job ends early, a
          consequence for late payment, and a limit on revisions.
        </p>
      ) : (
        <>
          <p className={styles.meta}>
            Your document doesn&rsquo;t mention any of these. Under each one is wording Redline drafted, and that
            wording isn&rsquo;t in your document.
          </p>
          <ul className={styles.missingList}>
            {entries.map((entry) => (
              <li key={entry.id} className={styles.missingEntry}>
                <span className={styles.outlineTip} aria-hidden="true" />
                <div className={styles.flagBody}>
                  <p className={styles.notInDocument}>Not in your document</p>
                  <h3 className={styles.flagTitle}>{PROTECTION_COPY[entry.protection]}</h3>
                  <p className={styles.statement}>{entry.statement}</p>
                  {entry.claims.length > 0 && <ClaimList claims={entry.claims} />}
                  <CounterOffer text={entry.proposedInsertion} idSuffix={entry.id} heading="Proposed insertion" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Read-off claims stand flat; inference claims carry a label in words, not a hedge. */
function ClaimList({ claims }: { claims: readonly (Claim | InferenceClaim)[] }) {
  return (
    <ul className={styles.claims}>
      {claims.map((claim, index) =>
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
  );
}

/**
 * A cited finding type kept outside the ranking and collapsed by default: Worth a look (ADR-0006) and
 * Multiplier notes (ADR-0003). Quieter than a Risk flag: no rank, no magenta tip, no Counter-offer.
 * The Source sentence is still shown verbatim.
 */
function UnrankedSection({
  heading,
  explainer,
  empty,
  entries,
}: {
  heading: string;
  explainer: string;
  empty: string;
  entries: readonly (WorthALook | MultiplierNote)[];
}) {
  if (entries.length === 0) {
    return <p className={`${styles.quiet} ${styles.unrankedEmpty}`}>{empty}</p>;
  }
  return (
    <details className={styles.unranked}>
      <summary className={styles.unrankedSummary}>
        <span className={styles.unrankedHeading}>{heading}</span>
        <span className={styles.unrankedCount}>{entries.length}</span>
      </summary>
      <p className={styles.meta}>{explainer}</p>
      <ul className={styles.unrankedList}>
        {entries.map((entry) => (
          <li key={entry.source.start} className={styles.unrankedEntry}>
            <h3 className={styles.flagTitle}>{entry.title}</h3>
            <ClaimList claims={entry.claims} />
            <blockquote className={styles.quote}>
              <p>“{entry.source.text}”</p>
            </blockquote>
            <p className={styles.meta}>Quoted word for word from your document</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

type CopyState = "idle" | "copied" | "failed";

/**
 * Redline's drafted wording with a one-action copy, set in Archivo because it is not the Document's
 * text: a Counter-offer for a Risk flag, or a Proposed insertion for a Missing protection.
 */
function CounterOffer({ text, idSuffix, heading }: { text: string; idSuffix: string; heading: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const headingId = `drafted-${idSuffix}`;

  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className={styles.counterOffer} aria-labelledby={headingId}>
      <div className={styles.counterOfferHead}>
        <h4 id={headingId} className={styles.counterOfferHeading}>
          {heading}
        </h4>
        <button type="button" className={styles.copyButton} onClick={copy} data-state={copyState}>
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={styles.counterOfferText}>{text}</p>
      <p className={styles.meta} role="status">
        {copyState === "failed"
          ? "Couldn't copy. Select the text and copy it by hand."
          : "Redline drafted this wording. It isn't in your document."}
      </p>
    </section>
  );
}
