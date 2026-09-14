import type { ModelClient } from "../model/model-client.ts";
import { CitationError, resolveSpan, sourceOf } from "../analysis/citation.ts";
import type { FailedCitation } from "../analysis/citation.ts";
import { DEFAULT_PART_BUDGET, splitIntoParts } from "../analysis/parts.ts";
import type { DocumentPart } from "../analysis/parts.ts";
import { runEveryPart } from "../analysis/run-parts.ts";
import { segmentSentences } from "../analysis/segment.ts";
import type { SentenceUnit } from "../analysis/segment.ts";
import type { ProvenanceTier, SourceSentence } from "../analysis/types.ts";
import { PROVENANCE_TIERS } from "../analysis/types.ts";
import { ANSWER_OUTCOMES, buildAnswerRequest } from "./prompt.ts";
import type { Answer, AnswerSentence, SignerFact } from "./types.ts";
import { SIGNER_FACTS } from "./types.ts";

/** The model's answer does not have the shape the schema demands, or mixes outcomes. */
export class AnswerResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerResponseError";
  }
}

export interface AnswerOptions {
  /** The most characters of unit lines one model call may carry. Defaults to `DEFAULT_PART_BUDGET`. */
  partBudget?: number;
}

interface RawSentence {
  text: string;
  tier: ProvenanceTier;
  signerFacts: SignerFact[];
  sources: { unitId: string; quote: string }[];
}

type RawAnswer =
  | { outcome: "answered"; sentences: RawSentence[] }
  | { outcome: "not-in-document" }
  | { outcome: "needs-signer-facts"; missingFacts: SignerFact[] };

/** One part's answer once every span in it matched, with withheld sentences already removed. */
type PartAnswer =
  | { outcome: "answered"; sentences: { sentence: AnswerSentence; unitIds: string[] }[] }
  | { outcome: "not-in-document" }
  | { outcome: "needs-signer-facts"; missingFacts: SignerFact[] };

/**
 * Answers the Signer's question from the Document's text only (capability 5). Every answer sentence
 * is grounded the way ADR-0010 grounds the summary: each span is checked verbatim, and any mismatch
 * throws `CitationError` for the whole answer.
 *
 * Withheld sentences: a sentence tagged needs-signer-facts is never returned (ADR-0007), though its
 * spans are still checked. If every sentence of an answer is withheld, the outcome becomes
 * `needs-signer-facts`, naming the facts those sentences said they depend on. The model did find the
 * text relevant, so "not in the document" would be false; and returning an answer with nothing in it
 * would read as a blank. What it could not do is answer without facts about the Signer, which is
 * exactly what `needs-signer-facts` says.
 *
 * Long Documents are asked part by part, and the parts' answers are merged:
 * - `answered` if any part answers. Its sentences are every part's shown sentences in part order; a
 *   sentence citing exactly the same units as one from an earlier part is the overlap read twice, and
 *   only the first is kept.
 * - otherwise `needs-signer-facts` if any part says so, naming every fact any part named, in order.
 * - otherwise `not-in-document`, which is therefore only returned when every part said so. One part
 *   not answering says nothing about the rest of the Document.
 * Any part failing fails the whole answer; there is no partial answer.
 */
export async function answerQuestion(
  documentText: string,
  question: string,
  modelClient: ModelClient,
  options: AnswerOptions = {},
): Promise<Answer> {
  if (question.trim() === "") {
    throw new AnswerResponseError("There is no question to answer.");
  }
  const units = segmentSentences(documentText);
  if (units.length === 0) {
    throw new AnswerResponseError("The document has no text to answer from.");
  }
  const parts = splitIntoParts(units, options.partBudget ?? DEFAULT_PART_BUDGET);
  const unitsById = new Map<string, SentenceUnit>(units.map((unit) => [unit.id, unit]));
  const answers = await runEveryPart(parts, async (part) => {
    const position = parts.length > 1 ? { index: part.index, count: parts.length } : undefined;
    const response = await modelClient.completeJson(buildAnswerRequest(part.units, question, position));
    return readPart(response, part, documentText, unitsById);
  });
  return merge(answers);
}

function readPart(
  response: unknown,
  part: DocumentPart,
  documentText: string,
  unitsById: ReadonlyMap<string, SentenceUnit>,
): PartAnswer {
  const raw = readAnswer(response);
  if (raw.outcome !== "answered") return raw;

  const failures: FailedCitation[] = [];
  const cited: { raw: RawSentence; sources: SourceSentence[]; unitIds: string[] }[] = [];
  raw.sentences.forEach((sentence, index) => {
    const sources: SourceSentence[] = [];
    sentence.sources.forEach(({ unitId, quote }, spanIndex) => {
      const resolved = resolveSpan(documentText, unitsById, unitId, quote);
      if ("reason" in resolved) {
        failures.push({ index, findingType: "answer-sentence", spanIndex, unitId, quote, reason: resolved.reason });
      } else {
        sources.push(sourceOf(documentText, resolved.unit));
      }
    });
    cited.push({ raw: sentence, sources, unitIds: sentence.sources.map((span) => span.unitId) });
  });
  if (failures.length > 0) {
    throw new CitationError(failures, raw.sentences.length);
  }

  // A part may cite only the units it was shown: a unit from elsewhere matches the stored text, but
  // the model never saw it in this request, so the answer is malformed.
  const shown = new Set(part.units.map((unit) => unit.id));
  const outside = [...new Set(cited.flatMap(({ unitIds }) => unitIds))].filter((id) => !shown.has(id));
  if (outside.length > 0) {
    throw new AnswerResponseError(
      `The model's answer cites ${outside.length === 1 ? "a unit" : "units"} outside the part it was shown: ${outside.join(", ")}.`,
    );
  }

  const kept = cited.filter(({ raw: sentence }) => sentence.tier !== "needs-signer-facts");
  if (kept.length === 0) {
    return { outcome: "needs-signer-facts", missingFacts: uniqueFacts(raw.sentences.flatMap((sentence) => sentence.signerFacts)) };
  }
  return {
    outcome: "answered",
    sentences: kept.map(({ raw: sentence, sources, unitIds }) => ({
      sentence: {
        tier: sentence.tier as AnswerSentence["tier"],
        text: sentence.text.trim(),
        sources: sources as [SourceSentence, ...SourceSentence[]],
      },
      unitIds,
    })),
  };
}

function merge(answers: readonly PartAnswer[]): Answer {
  const answered = answers.flatMap((answer) => (answer.outcome === "answered" ? answer.sentences : []));
  if (answered.length > 0) {
    const seen = new Set<string>();
    const sentences = answered.flatMap(({ sentence, unitIds }) => {
      const key = [...unitIds].sort().join(",");
      if (answers.length > 1 && seen.has(key)) return [];
      seen.add(key);
      return [sentence];
    });
    return { outcome: "answered", sentences: sentences as [AnswerSentence, ...AnswerSentence[]] };
  }
  const facts = uniqueFacts(answers.flatMap((answer) => (answer.outcome === "needs-signer-facts" ? answer.missingFacts : [])));
  if (answers.some((answer) => answer.outcome === "needs-signer-facts")) {
    return { outcome: "needs-signer-facts", missingFacts: facts as [SignerFact, ...SignerFact[]] };
  }
  return { outcome: "not-in-document" };
}

function uniqueFacts(facts: readonly SignerFact[]): SignerFact[] {
  return SIGNER_FACTS.filter((fact) => facts.includes(fact));
}

/**
 * Reads the model's answer. Any of these fails as malformed: an unknown outcome; fields an outcome
 * does not use left non-empty (a mixed outcome); `answered` with no sentence; a sentence with blank
 * text, an unknown tier, no spans, a span without a string unit id and quote, or one unit twice; a
 * needs-signer-facts sentence that names no fact, or another sentence that names one;
 * `needs-signer-facts` naming no fact; an unknown fact.
 */
function readAnswer(response: unknown): RawAnswer {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    throw new AnswerResponseError("The model's answer is not an object.");
  }
  const body = response as Record<string, unknown>;
  const outcome = body.outcome as (typeof ANSWER_OUTCOMES)[number];
  if (!ANSWER_OUTCOMES.includes(outcome)) {
    throw new AnswerResponseError("The model's answer has no known outcome.");
  }
  if (!Array.isArray(body.sentences)) throw new AnswerResponseError("The model's answer has no sentences list.");
  if (!Array.isArray(body.missingFacts)) throw new AnswerResponseError("The model's answer has no missingFacts list.");
  const { sentences, missingFacts } = body as { sentences: unknown[]; missingFacts: unknown[] };

  if (outcome === "not-in-document") {
    if (sentences.length > 0 || missingFacts.length > 0) {
      throw new AnswerResponseError("The model's answer says the document does not answer, but also carries sentences or facts.");
    }
    return { outcome };
  }
  if (outcome === "needs-signer-facts") {
    if (sentences.length > 0) {
      throw new AnswerResponseError("The model's answer says it needs facts about the Signer, but also carries sentences.");
    }
    return { outcome, missingFacts: readFacts(missingFacts, "missingFacts") };
  }

  if (missingFacts.length > 0) {
    throw new AnswerResponseError("The model's answer is answered, but also names facts about the Signer it needs.");
  }
  if (sentences.length === 0) {
    throw new AnswerResponseError("The model's answer is answered, but has no sentence.");
  }
  return {
    outcome,
    sentences: sentences.map((item, index) => {
      const sentence = item as Partial<Record<keyof RawSentence, unknown>> | undefined;
      const problems: string[] = [];
      if (typeof sentence?.text !== "string" || sentence.text.trim() === "") problems.push("text is blank");
      if (!PROVENANCE_TIERS.includes(sentence?.tier as ProvenanceTier)) problems.push("tier is not a known tier");
      if (!Array.isArray(sentence?.signerFacts)) {
        problems.push("signerFacts is not a list");
      } else if (sentence.tier === "needs-signer-facts" && sentence.signerFacts.length === 0) {
        problems.push("it needs facts about the Signer but names none");
      } else if (sentence.tier !== "needs-signer-facts" && sentence.signerFacts.length > 0) {
        problems.push(`it names facts about the Signer, but its tier is ${String(sentence.tier)}`);
      } else if (sentence.signerFacts.some((fact) => !SIGNER_FACTS.includes(fact as SignerFact))) {
        problems.push("signerFacts has an unknown fact");
      }
      if (!Array.isArray(sentence?.sources)) {
        problems.push("sources is not a list");
      } else if (sentence.sources.length === 0) {
        problems.push("it cites no span of the document");
      } else {
        const seen = new Set<string>();
        sentence.sources.forEach((span: unknown, spanIndex: number) => {
          const { unitId, quote } = (span ?? {}) as { unitId?: unknown; quote?: unknown };
          if (typeof unitId !== "string" || typeof quote !== "string") {
            problems.push(`span ${spanIndex} has no unitId or quote`);
            return;
          }
          if (seen.has(unitId)) problems.push(`span ${spanIndex} cites unit ${unitId} a second time`);
          seen.add(unitId);
        });
      }
      if (problems.length > 0) {
        throw new AnswerResponseError(`Answer sentence #${index} in the model's answer is malformed: ${problems.join(", ")}.`);
      }
      return sentence as RawSentence;
    }),
  };
}

function readFacts(facts: readonly unknown[], key: string): SignerFact[] {
  if (facts.length === 0) {
    throw new AnswerResponseError(`The model's answer needs facts about the Signer, but ${key} names none.`);
  }
  if (facts.some((fact) => !SIGNER_FACTS.includes(fact as SignerFact))) {
    throw new AnswerResponseError(`The model's ${key} has an unknown fact.`);
  }
  return uniqueFacts(facts as SignerFact[]);
}
