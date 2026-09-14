"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { HarmCheck } from "../../../lib/analysis/checks";
import type {
  AnalysisResult,
  CheckId,
  ChecklistItem,
  Claim,
  CrossedRedLine,
  InferenceClaim,
  MissingProtection,
  MultiplierNote,
  NiceToHave,
  NiceToHaveKind,
  ProtectionKind,
  SeverityBand,
  SummarySentence,
  WorthALook,
} from "../../../lib/analysis/types";
import styles from "../app.module.css";
import { ExportAction } from "./ExportAction";
import { QuestionBox } from "./QuestionBox";
import { SourceReveal } from "./SourceReveal";
import {
  DOCUMENT_PAGE_ID,
  DocumentView,
  multiplierNoteMarkId,
  riskFlagMarkId,
  worthALookMarkId,
} from "./DocumentView";

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

const NICE_TO_HAVE_COPY: Record<NiceToHaveKind, string> = {
  ...PROTECTION_COPY,
  "portfolio-rights": "Showing the work in your portfolio",
  attribution: "Credit for your work",
  "expense-reimbursement": "Paying back your expenses",
  "feedback-deadlines": "Deadlines for the other side's feedback",
  confidentiality: "Confidentiality",
};

const CHECK_COPY: Record<CheckId, string> = {
  ...PROTECTION_COPY,
  "uncapped-liability": "Liability or indemnity with no cap",
  "lock-in": "Lock-in, or a renewal that's hard to cancel",
  "non-compete": "Non-compete or non-solicit",
  "ip-overreach": "Rights to more than the work you're paid for",
  "personal-guarantee": "A personal guarantee",
};

/** How the clean statement names a harm check that passed. */
const CLEAR_COPY: Record<HarmCheck, string> = {
  "uncapped-liability": "uncapped liability",
  "lock-in": "lock-in",
  "non-compete": "non-compete",
  "ip-overreach": "claim on work you aren't paid for",
  "personal-guarantee": "personal guarantee",
};

/** How the clean statement names a protection the Document states. */
const STATED_COPY: Record<ProtectionKind, string> = {
  "payment-timing": "when you're paid",
  "payment-amount": "how much you're paid",
  "kill-fee": "pay for work done if the job ends early",
  "late-payment-remedy": "what happens if you're paid late",
  "scope-revision-limits": "a limit on revisions",
};

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinList(items: readonly string[], conjunction = "and"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/**
 * The result: the stored Document as a page beside the analysis rail. Exactly one finding is pulled
 * at a time, and Risk flag 1 starts pulled (DESIGN.md, The One Pulled Flag Rule). Selecting a
 * finding in the rail or a tab on the page pulls it and scrolls the page to its Source sentence.
 */
export function ResultView({
  fileName,
  text,
  result,
  redLineCount,
  notice,
}: {
  fileName: string;
  text: string;
  result: AnalysisResult;
  redLineCount: number;
  /** A quiet line under the summary about the result itself, such as whether it was saved. */
  notice?: ReactNode;
}) {
  const firstFlag = result.riskFlags.find((flag) => flag.rank === 1) ?? result.riskFlags[0];
  const [selection, setSelection] = useState<{ id: string | null; request: number }>({
    id: firstFlag ? riskFlagMarkId(firstFlag) : null,
    request: 0,
  });
  const pull = (id: string) => setSelection((current) => ({ id, request: current.request + 1 }));

  return (
    <div className={styles.reader}>
      <DocumentView
        fileName={fileName}
        text={text}
        result={result}
        pulled={selection.id}
        scrollRequest={selection.request}
        onPull={pull}
      />
      <div className={styles.rail}>
        <SummarySection fileName={fileName} sentences={result.summary} />
        {notice}
        {redLineCount > 0 && (
          <p className={styles.meta}>
            {`Checked against your ${redLineCount} red ${redLineCount === 1 ? "line" : "lines"}.`}
          </p>
        )}
        {result.nothingFound ? (
          <CleanResult fileName={fileName} checklist={result.checklist} />
        ) : (
          <RiskFlagList fileName={fileName} result={result} pulled={selection.id} onPull={pull} />
        )}
        <MissingProtectionList fileName={fileName} entries={result.missingProtections} />
        <QuestionBox fileName={fileName} text={text} />
        <ExportAction fileName={fileName} text={text} result={result} />
        <ChecklistSection checklist={result.checklist} />
        <UnrankedSection
          heading="Worth a look"
          explainer="These clauses are one-sided or unusual, but each has a limit and a way out, so they aren’t ranked with the risk flags."
          empty="Nothing for Worth a look in this document."
          entries={result.worthALook}
          markId={worthALookMarkId}
          pulled={selection.id}
          onPull={pull}
        />
        <NiceToHaveSection entries={result.niceToHave} />
        <UnrankedSection
          heading="Multiplier notes"
          explainer="These clauses make things harder for you if something else in the agreement goes wrong. On their own they cost you nothing, so they aren’t ranked with the risk flags."
          empty="No multiplier notes in this document."
          entries={result.multiplierNotes}
          markId={multiplierNoteMarkId}
          pulled={selection.id}
          onPull={pull}
        />
      </div>
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
  return (
    <li className={styles.summaryItem}>
      <p className={styles.summaryText}>
        {sentence.tier === "inference" && <span className={styles.inferenceLabel}>Inference</span>}{" "}
        {sentence.text}
      </p>
      <SourceReveal id={`summary-sources-${index}`} sources={sentence.sources} />
    </li>
  );
}

/**
 * The nothing-found state (ADR-0008), shown in place of the Risk flag list when `analyse` returned
 * none. Every phrase comes from a checklist outcome, so it says only what the checks found. It never
 * says the Document is safe to sign.
 */
function CleanResult({ fileName, checklist }: { fileName: string; checklist: readonly ChecklistItem[] }) {
  const clear = checklist.flatMap((item) =>
    item.outcome === "not-found" || item.outcome === "bounded" ? [CLEAR_COPY[item.check]] : [],
  );
  const stated = checklist.flatMap((item) => (item.outcome === "present" ? [STATED_COPY[item.check]] : []));
  const first = joinList(clear, "or");
  return (
    <section className={styles.clean} aria-labelledby="clean-heading">
      <h2 id="clean-heading" className={styles.cleanHeading}>
        No risk flags in {fileName}
      </h2>
      {first !== "" && (
        <p className={styles.cleanText}>
          Redline found no {first}.{stated.length > 0 && ` Your document covers ${joinList(stated)}.`}
        </p>
      )}
      <p className={styles.meta}>The checklist below shows every check and the sentences behind it.</p>
    </section>
  );
}

function RiskFlagList({
  fileName,
  result,
  pulled,
  onPull,
}: {
  fileName: string;
  result: AnalysisResult;
  pulled: string | null;
  onPull: (id: string) => void;
}) {
  const count = result.riskFlags.length;
  return (
    <div>
      <h2 className={styles.listHeading}>
        {`${count} risk ${count === 1 ? "flag" : "flags"} in ${fileName}, most likely to cost you first`}
      </h2>
      <ol className={styles.flags}>
          {result.riskFlags.map((flag) => {
            const id = riskFlagMarkId(flag);
            const isPulled = id === pulled;
            return (
            <li
              key={`${flag.rank}-${flag.source.start}`}
              className={styles.flag}
              data-pulled={isPulled || undefined}
              onClick={() => onPull(id)}
            >
              <span className={styles.tip} aria-hidden="true">
                {flag.rank}
              </span>
              <div className={styles.flagBody}>
                <h3 className={styles.flagTitle}>
                  <button
                    type="button"
                    className={styles.flagButton}
                    aria-pressed={isPulled}
                    aria-controls={DOCUMENT_PAGE_ID}
                  >
                    <span className={styles.visuallyHidden}>Risk flag {flag.rank}: </span>
                    {flag.title}
                  </button>
                </h3>
                <p className={styles.severity}>{SEVERITY_COPY[flag.severityBand]}</p>
                <CrossedRedLines redLines={flag.redLines} />
                <ClaimList claims={flag.claims} />
                <blockquote className={styles.quote}>
                  <p>“{flag.source.text}”</p>
                </blockquote>
                <p className={styles.meta}>Quoted word for word from your document</p>
                <CounterOffer text={flag.counterOffer} idSuffix={String(flag.rank)} heading="Counter-offer" />
              </div>
            </li>
            );
          })}
      </ol>
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
          : `${capitalise(fileName)} leaves out ${count} ${count === 1 ? "protection" : "protections"}`}
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

/** What an outcome says, in the Signer's words. Cited outcomes add their detail and a quote reveal. */
function outcomeCopy(item: ChecklistItem): string {
  switch (item.outcome) {
    case "not-found":
      return "Not found";
    case "bounded":
      return "Found, with a cap or a way out";
    case "flagged": {
      const ranks = item.riskFlagRanks.map(String);
      return `Found: risk ${ranks.length === 1 ? "flag" : "flags"} ${joinList(ranks)}`;
    }
    case "present":
      return "In your document";
    case "missing":
      return item.absence.kind === "missing-protection"
        ? "Not in your document. See missing protections."
        : "Not in your document. See Nice to have.";
  }
}

/** The checklist of what was examined (ADR-0008): a product surface, shown on every result. */
function ChecklistSection({ checklist }: { checklist: readonly ChecklistItem[] }) {
  return (
    <section className={styles.checklist} aria-labelledby="checklist-heading">
      <h2 id="checklist-heading" className={styles.listHeading}>
        What Redline checked
      </h2>
      <ul className={styles.checkList}>
        {checklist.map((item) => (
          <li key={item.check} className={styles.checkItem}>
            <p className={styles.checkLabel}>{CHECK_COPY[item.check]}</p>
            <div>
              <p className={styles.checkOutcome} data-outcome={item.outcome}>
                {outcomeCopy(item)}
                {(item.outcome === "present" || item.outcome === "bounded") && (
                  <span className={styles.checkDetail}>{item.detail}</span>
                )}
              </p>
              {(item.outcome === "present" || item.outcome === "bounded") && (
                <SourceReveal id={`check-source-${item.check}`} sources={[item.source]} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Nice to have (ADR-0008): minor absences, collapsed by default and quieter than Missing
 * protections. No tip and no quote, since each cites nothing. Its Proposed insertion reuses the
 * Counter-offer box.
 */
function NiceToHaveSection({ entries }: { entries: readonly NiceToHave[] }) {
  if (entries.length === 0) {
    return <p className={`${styles.quiet} ${styles.unrankedEmpty}`}>Nothing listed under Nice to have.</p>;
  }
  return (
    <details className={styles.unranked}>
      <summary className={styles.unrankedSummary}>
        <span className={styles.unrankedHeading}>Nice to have</span>
        <span className={styles.unrankedCount}>{entries.length}</span>
      </summary>
      <p className={styles.meta}>
        Your document leaves these out too, but missing them is less likely to hurt you than a missing protection.
        Redline drafted the wording under each one. It isn&rsquo;t in your document.
      </p>
      <ul className={styles.unrankedList}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.unrankedEntry}>
            <p className={styles.notInDocument}>Not in your document</p>
            <h3 className={styles.flagTitle}>{NICE_TO_HAVE_COPY[entry.protection]}</h3>
            <p className={styles.statement}>{entry.statement}</p>
            {entry.claims.length > 0 && <ClaimList claims={entry.claims} />}
            <CounterOffer text={entry.proposedInsertion} idSuffix={entry.id} heading="Proposed insertion" />
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The Signer's red lines a finding crosses, quoted in their own words. Those words are the Signer's,
 * not the Document's, so they are set in Archivo, never Tinos.
 */
function CrossedRedLines({ redLines }: { redLines: readonly CrossedRedLine[] }) {
  if (redLines.length === 0) return null;
  return (
    <div className={styles.crossed}>
      <p className={styles.crossedLabel}>
        <span className={styles.redLineTip} aria-hidden="true" />
        {redLines.length === 1 ? "Crosses your red line" : "Crosses your red lines"}
      </p>
      <ul className={styles.crossedList}>
        {redLines.map((line) => (
          <li key={line.id} className={styles.crossedText}>
            &ldquo;{line.text}&rdquo;
          </li>
        ))}
      </ul>
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
  markId,
  pulled,
  onPull,
}: {
  heading: string;
  explainer: string;
  empty: string;
  entries: readonly (WorthALook | MultiplierNote)[];
  markId: (index: number) => string;
  pulled: string | null;
  onPull: (id: string) => void;
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
        {entries.map((entry, index) => (
          <li key={`${index}-${entry.source.start}`} className={styles.unrankedEntry}>
            <h3 className={styles.flagTitle}>{entry.title}</h3>
            {entry.kind === "multiplier-note" && <CrossedRedLines redLines={entry.redLines} />}
            <ClaimList claims={entry.claims} />
            <blockquote className={styles.quote}>
              <p>“{entry.source.text}”</p>
            </blockquote>
            <p className={styles.meta}>Quoted word for word from your document</p>
            <button
              type="button"
              className={styles.sourceToggle}
              aria-pressed={markId(index) === pulled}
              aria-controls={DOCUMENT_PAGE_ID}
              onClick={() => onPull(markId(index))}
            >
              Show it in the document
            </button>
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
