import type { JsonCompletionRequest, ModelClient } from "../../lib/model/model-client";
import { segmentSentences } from "../../lib/analysis/segment";
import type { SentenceUnit } from "../../lib/analysis/segment";
import { QUESTION_LINE_PREFIX } from "../../lib/question/prompt";
import type { Fixture, ModelSpan, ModelTier } from "./sidecar-model-client";

/** One answer sentence as scripted by a test: it cites planted clauses by their sidecar id. */
export interface ScriptedSentence {
  text: string;
  tier: ModelTier;
  /** Sidecar clause ids (e.g. "RF-1") whose sentences this answer sentence rests on, in order. */
  cites: string[];
  signerFacts?: string[];
}

export type ScriptedAnswer =
  | { outcome: "answered"; sentences: ScriptedSentence[] }
  | { outcome: "not-in-document" }
  /** `about`: a clause id; a part that cannot see it says not-in-document instead. */
  | { outcome: "needs-signer-facts"; missingFacts: string[]; about?: string };

export interface ModelAnswerSentence {
  text: string;
  tier: string;
  signerFacts: string[];
  sources: ModelSpan[];
}

export interface ModelAnswerPayload {
  outcome: string;
  sentences: ModelAnswerSentence[];
  missingFacts: string[];
}

export interface QuestionClientOptions {
  /** Send this quote instead of the unit's exact text for one span of one answered sentence. */
  tamperQuote?: { sentence: number; span: number; quote: string };
  /** Answered sentences (by position in the answer sent) sent with an empty sources list. */
  withoutSpans?: number[];
  /** Send an answered payload that also names a fact about the Signer it needs. */
  mixOutcomes?: boolean;
  /** Send an answered payload with no sentences. */
  emptyAnswered?: boolean;
  /** Reshape any payload before it is sent. */
  tamper?: (payload: ModelAnswerPayload) => ModelAnswerPayload;
}

/**
 * A synthetic ModelClient that answers questions the way a correct model would for a fixture. Each
 * question the test asks is looked up in `script`; answered sentences cite the units the product's own
 * segmenter gives the planted sidecar sentences. When a request shows only part of the Document, an
 * answered sentence is sent only if every sentence it cites is shown, and a part that can show none
 * says not-in-document. Every request is kept in `requests`, and every answer in `calls`.
 */
export class QuestionModelClient implements ModelClient {
  readonly requests: JsonCompletionRequest[] = [];
  readonly calls: { question: string; unitIds: string[]; response: ModelAnswerPayload }[] = [];
  private readonly units: SentenceUnit[];

  constructor(
    private readonly fixture: Fixture,
    private readonly script: Record<string, ScriptedAnswer>,
    private readonly options: QuestionClientOptions = {},
  ) {
    this.units = segmentSentences(fixture.text);
    for (const answer of Object.values(script)) {
      const ids = answer.outcome === "answered" ? answer.sentences.flatMap((s) => s.cites) : answer.outcome === "needs-signer-facts" && answer.about ? [answer.about] : [];
      for (const id of ids) this.sentenceOf(id);
    }
  }

  async completeJson(request: JsonCompletionRequest): Promise<unknown> {
    this.requests.push(request);
    const line = request.user.split("\n").find((candidate) => candidate.startsWith(QUESTION_LINE_PREFIX));
    if (!line) throw new Error("The request carries no question line.");
    const question = JSON.parse(line.slice(QUESTION_LINE_PREFIX.length)) as string;
    const scripted = this.script[question];
    if (!scripted) throw new Error(`No scripted answer for ${JSON.stringify(question)}.`);
    const shownIds = new Set([...request.user.matchAll(/^\[(u\d+)\] "/gm)].map((match) => match[1]));
    const visible = this.units.filter((unit) => shownIds.has(unit.id));

    let payload = this.payloadFor(scripted, visible);
    if (this.options.tamper) payload = this.options.tamper(payload);
    this.calls.push({ question, unitIds: visible.map((unit) => unit.id), response: structuredClone(payload) });
    return payload;
  }

  private payloadFor(scripted: ScriptedAnswer, visible: readonly SentenceUnit[]): ModelAnswerPayload {
    const notInDocument = { outcome: "not-in-document", sentences: [], missingFacts: [] };
    const find = (id: string) => visible.find((unit) => unit.text === this.sentenceOf(id));
    if (scripted.outcome === "not-in-document") return notInDocument;
    if (scripted.outcome === "needs-signer-facts") {
      if (scripted.about && !find(scripted.about)) return notInDocument;
      return { outcome: "needs-signer-facts", sentences: [], missingFacts: [...scripted.missingFacts] };
    }

    const { tamperQuote, withoutSpans = [], mixOutcomes = false, emptyAnswered = false } = this.options;
    const sentences = scripted.sentences
      .filter((sentence) => sentence.cites.every((id) => find(id)))
      .map(
        (sentence, position): ModelAnswerSentence => ({
          text: sentence.text,
          tier: sentence.tier,
          signerFacts: [...(sentence.signerFacts ?? [])],
          sources: withoutSpans.includes(position)
            ? []
            : sentence.cites.map((id, span) => {
                const unit = find(id)!;
                const tampered = tamperQuote?.sentence === position && tamperQuote.span === span;
                return { unitId: unit.id, quote: tampered ? tamperQuote.quote : unit.text };
              }),
        }),
      );
    if (sentences.length === 0) return notInDocument;
    return {
      outcome: "answered",
      sentences: emptyAnswered ? [] : sentences,
      missingFacts: mixOutcomes ? ["jurisdiction"] : [],
    };
  }

  private sentenceOf(clauseId: string): string {
    const clause = this.fixture.sidecar.plantedClauses.find((candidate) => candidate.id === clauseId);
    if (!clause) throw new Error(`${clauseId} is not a planted clause in ${this.fixture.sidecar.document}.`);
    if (!this.units.some((unit) => unit.text === clause.sentence)) {
      throw new Error(`Planted sentence ${clauseId} is not a single unit of ${this.fixture.sidecar.document}.`);
    }
    return clause.sentence;
  }
}
