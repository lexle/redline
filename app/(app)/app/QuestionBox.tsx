"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { QuestionFailureCode, QuestionRequestBody, QuestionResponseBody } from "../../../lib/question/api";
import type { Answer, SignerFact } from "../../../lib/question/types";
import styles from "../app.module.css";
import { SourceReveal } from "./SourceReveal";

type FailureReason = QuestionFailureCode | "offline";

type Exchange =
  | { id: number; question: string; state: "asking" }
  | { id: number; question: string; state: "answered"; answer: Answer }
  | { id: number; question: string; state: "failed"; reason: FailureReason };

const FAILURE_COPY: Record<FailureReason, string> = {
  offline: "Couldn't reach Redline. Check your connection and try again.",
  "bad-request": "The question didn't reach the server intact. Try again.",
  "not-configured": "Questions aren't set up on this server yet.",
  citation:
    "The answer quoted a sentence that doesn't match your document word for word, so none of it is shown. Try asking again.",
  "model-unavailable": "The answering service sent back something Redline couldn't use. Try again in a minute.",
  unexpected: "Something went wrong while answering. Try again.",
};

const FACT_COPY: Record<SignerFact, string> = {
  jurisdiction: "the law where you work",
  industry: "what's usual in your industry",
  leverage: "how much bargaining power you have",
  other: "other facts about your situation",
};

function joinFacts(facts: readonly SignerFact[]): string {
  const items = facts.map((fact) => FACT_COPY[fact]);
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The question box (capability 5). Answers come only from the Document's text. Each answered sentence
 * is Redline's words in Archivo and reveals the Source sentences it rests on in Tinos. A question the
 * Document doesn't answer, or one that turns on facts about the Signer, gets a plain statement that
 * reads as an answer (ADR-0007); only a failed call is shown as a failure. Earlier questions stay.
 */
export function QuestionBox({ fileName, text }: { fileName: string; text: string }) {
  const [question, setQuestion] = useState("");
  const [refused, setRefused] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const nextId = useRef(0);
  const asking = exchanges.some((exchange) => exchange.state === "asking");

  function settle(id: number, update: Exchange) {
    setExchanges((current) => current.map((exchange) => (exchange.id === id ? update : exchange)));
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = question;
    if (asked.trim() === "") {
      setRefused(true);
      return;
    }
    setRefused(false);
    setQuestion("");
    const id = nextId.current++;
    setExchanges((current) => [...current, { id, question: asked, state: "asking" }]);

    const body: QuestionRequestBody = { text, question: asked };
    let response: Response;
    try {
      response = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      settle(id, { id, question: asked, state: "failed", reason: "offline" });
      return;
    }
    let payload: QuestionResponseBody;
    try {
      payload = (await response.json()) as QuestionResponseBody;
    } catch {
      settle(id, { id, question: asked, state: "failed", reason: "unexpected" });
      return;
    }
    if (payload.ok === true && response.ok) {
      settle(id, { id, question: asked, state: "answered", answer: payload.answer });
    } else {
      const code = "code" in payload ? payload.code : undefined;
      const reason: FailureReason = code !== undefined && code in FAILURE_COPY ? code : "unexpected";
      settle(id, { id, question: asked, state: "failed", reason });
    }
  }

  return (
    <section className={styles.questions} aria-labelledby="questions-heading">
      <h2 id="questions-heading" className={styles.listHeading}>
        Ask about {fileName}
      </h2>
      <p className={styles.meta}>
        Redline answers only from your document&rsquo;s text, and shows the sentences behind each answer.
      </p>

      {exchanges.length > 0 && (
        <ol className={styles.exchanges}>
          {exchanges.map((exchange) => (
            <li key={exchange.id} className={styles.exchange}>
              <p className={styles.asked}>
                <span className={styles.visuallyHidden}>You asked: </span>
                {exchange.question}
              </p>
              <ExchangeOutcome exchange={exchange} />
            </li>
          ))}
        </ol>
      )}

      <form className={styles.questionForm} onSubmit={ask} noValidate>
        <label htmlFor="question-input" className={styles.questionLabel}>
          Your question
        </label>
        <textarea
          id="question-input"
          className={styles.questionInput}
          value={question}
          rows={2}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (refused) setRefused(false);
          }}
          aria-invalid={refused || undefined}
          aria-describedby={refused ? "question-error" : undefined}
        />
        {refused && (
          <p id="question-error" className={styles.pasteError} role="alert">
            Type a question first.
          </p>
        )}
        <button type="submit" className={styles.questionButton} disabled={asking}>
          Ask
        </button>
      </form>
    </section>
  );
}

function ExchangeOutcome({ exchange }: { exchange: Exchange }) {
  if (exchange.state === "asking") {
    return (
      <p className={styles.status} role="status">
        <span className={styles.pulse} aria-hidden="true" />
        Reading your document for an answer…
      </p>
    );
  }
  if (exchange.state === "failed") {
    return (
      <div className={styles.questionFailure} role="alert">
        <p className={styles.failureHeading}>Redline couldn&apos;t answer this</p>
        <p className={styles.failureText}>{FAILURE_COPY[exchange.reason]}</p>
      </div>
    );
  }
  const { answer } = exchange;
  switch (answer.outcome) {
    case "not-in-document":
      return (
        <p className={styles.answerStatement} data-outcome="not-in-document">
          Nothing in your document answers this.
        </p>
      );
    case "needs-signer-facts":
      return (
        <p className={styles.answerStatement} data-outcome="needs-signer-facts">
          The answer depends on {joinFacts(answer.missingFacts)}. Redline doesn&apos;t know that about you and won&apos;t
          guess.
        </p>
      );
    case "answered":
      return (
        <ul className={styles.answerList}>
          {answer.sentences.map((sentence, index) => (
            <li key={`${index}-${sentence.sources[0].start}`} className={styles.answerItem}>
              <p className={styles.summaryText}>
                {sentence.tier === "inference" && <span className={styles.inferenceLabel}>Inference</span>}{" "}
                {sentence.text}
              </p>
              <SourceReveal id={`answer-${exchange.id}-sources-${index}`} sources={sentence.sources} />
            </li>
          ))}
        </ul>
      );
  }
}
