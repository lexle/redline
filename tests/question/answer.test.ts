import { describe, expect, it } from "vitest";
import { CitationError } from "../../lib/analysis/analyse";
import { segmentSentences } from "../../lib/analysis/segment";
import { createOpenRouterClient } from "../../lib/model/openrouter-client";
import { answerQuestion, AnswerResponseError } from "../../lib/question/answer";
import { ANSWER_SCHEMA, ANSWER_SCHEMA_NAME } from "../../lib/question/prompt";
import { loadFixture } from "../support/sidecar-model-client";
import type { Fixture } from "../support/sidecar-model-client";
import { QuestionModelClient } from "../support/question-model-client";
import type { QuestionClientOptions, ScriptedAnswer } from "../support/question-model-client";

const adhesion = loadFixture("adhesion-contract");
const clean = loadFixture("clean-agreement");
const planted = (id: string) => adhesion.sidecar.plantedClauses.find((clause) => clause.id === id)!;

const STOP_EARLY = "What happens if I stop working before the project is finished?";
const PAY_DAY = "Which day of the month am I paid?";
const CALIFORNIA = "Is the non-compete enforceable in California?";

const script: Record<string, ScriptedAnswer> = {
  [STOP_EARLY]: {
    outcome: "answered",
    sentences: [
      { text: "You pay the Client's costs to finish the project, including a replacement contractor.", tier: "read-off", cites: ["RF-1"] },
      { text: "Those costs could reach you personally if you work through a company.", tier: "inference", cites: ["RF-1", "RF-3"] },
    ],
  },
  [PAY_DAY]: { outcome: "not-in-document" },
  [CALIFORNIA]: { outcome: "needs-signer-facts", missingFacts: ["jurisdiction"] },
};

const ask = (question: string, options: QuestionClientOptions = {}, fixture: Fixture = adhesion) =>
  answerQuestion(fixture.text, question, new QuestionModelClient(fixture, script, options));

describe("answerQuestion", () => {
  it("returns grounded sentences whose spans are the stored slices of the planted sentences", async () => {
    const answer = await ask(STOP_EARLY);

    expect(answer.outcome).toBe("answered");
    if (answer.outcome !== "answered") return;
    expect(answer.sentences.map((sentence) => sentence.tier)).toEqual(["read-off", "inference"]);
    expect(answer.sentences[1].sources.map((source) => source.text)).toEqual([planted("RF-1").sentence, planted("RF-3").sentence]);
    for (const source of answer.sentences.flatMap((sentence) => sentence.sources)) {
      expect(adhesion.text.slice(source.start, source.end)).toBe(source.text);
    }
  });

  it("throws CitationError when a span's quote does not match its unit", async () => {
    const failure = await ask(STOP_EARLY, { tamperQuote: { sentence: 1, span: 1, quote: "The individual guarantees nothing." } }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(CitationError);
    const unit = segmentSentences(adhesion.text).find((candidate) => candidate.text === planted("RF-3").sentence)!;
    expect((failure as CitationError).failures).toEqual([
      { index: 1, findingType: "answer-sentence", spanIndex: 1, unitId: unit.id, quote: "The individual guarantees nothing.", reason: "quote-mismatch" },
    ]);
  });

  it("throws CitationError when a span cites a unit that does not exist", async () => {
    const tamper = (payload: { outcome: string; sentences: { sources: { unitId: string }[] }[]; missingFacts: string[] }) => {
      payload.sentences[0].sources[0].unitId = "u9999";
      return payload;
    };
    await expect(ask(STOP_EARLY, { tamper: tamper as QuestionClientOptions["tamper"] })).rejects.toBeInstanceOf(CitationError);
  });

  it("says the Document does not answer, with no sentences, when the text is silent", async () => {
    expect(await ask(PAY_DAY)).toEqual({ outcome: "not-in-document" });
  });

  it("says a jurisdiction question needs facts about the Signer, and names jurisdiction", async () => {
    expect(await ask(CALIFORNIA)).toEqual({ outcome: "needs-signer-facts", missingFacts: ["jurisdiction"] });
  });

  it.each<[string, QuestionClientOptions, RegExp]>([
    ["a sentence with zero spans", { withoutSpans: [0] }, /cites no span/],
    ["an answer that also names missing facts", { mixOutcomes: true }, /also names facts/],
    ["an answered outcome with no sentence", { emptyAnswered: true }, /has no sentence/],
    ["blank sentence text", { tamper: (p) => ({ ...p, sentences: p.sentences.map((s) => ({ ...s, text: "  " })) }) }, /text is blank/],
    ["an unknown tier", { tamper: (p) => ({ ...p, sentences: p.sentences.map((s) => ({ ...s, tier: "certain" })) }) }, /tier is not a known tier/],
    ["an unknown outcome", { tamper: (p) => ({ ...p, outcome: "maybe" }) }, /no known outcome/],
  ])("fails as malformed for %s", async (_name, options, message) => {
    const failure = await ask(STOP_EARLY, options).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AnswerResponseError);
    expect((failure as Error).message).toMatch(message);
  });

  it("fails as malformed when not-in-document carries sentences", async () => {
    const tamper: QuestionClientOptions["tamper"] = (payload) => ({
      ...payload,
      sentences: [{ text: "Probably the first.", tier: "inference", signerFacts: [], sources: [] }],
    });
    await expect(ask(PAY_DAY, { tamper })).rejects.toThrow(/does not answer, but also carries/);
  });

  it("fails as malformed when needs-signer-facts names no fact", async () => {
    await expect(ask(CALIFORNIA, { tamper: (payload) => ({ ...payload, missingFacts: [] }) })).rejects.toThrow(AnswerResponseError);
  });

  it("withholds sentences that need facts about the Signer and keeps the rest", async () => {
    const tamper: QuestionClientOptions["tamper"] = (payload) => ({
      ...payload,
      sentences: payload.sentences.map((s, i) => (i === 1 ? { ...s, tier: "needs-signer-facts", signerFacts: ["jurisdiction"] } : s)),
    });
    const answer = await ask(STOP_EARLY, { tamper });
    expect(answer.outcome).toBe("answered");
    if (answer.outcome !== "answered") return;
    expect(answer.sentences.map((sentence) => sentence.text)).toEqual([script[STOP_EARLY].outcome === "answered" ? script[STOP_EARLY].sentences[0].text : ""]);
  });

  it("turns an answer whose every sentence is withheld into needs-signer-facts, naming their facts", async () => {
    const tamper: QuestionClientOptions["tamper"] = (payload) => ({
      ...payload,
      sentences: payload.sentences.map((s, i) => ({ ...s, tier: "needs-signer-facts", signerFacts: i === 0 ? ["leverage"] : ["industry", "leverage"] })),
    });
    expect(await ask(STOP_EARLY, { tamper })).toEqual({ outcome: "needs-signer-facts", missingFacts: ["industry", "leverage"] });
  });

  it("still checks the spans of a withheld sentence", async () => {
    const tamper: QuestionClientOptions["tamper"] = (payload) => ({
      ...payload,
      sentences: payload.sentences.map((s) => ({ ...s, tier: "needs-signer-facts", signerFacts: ["jurisdiction"], sources: s.sources.map((span) => ({ ...span, quote: `${span.quote} ` })) })),
    });
    await expect(ask(STOP_EARLY, { tamper })).rejects.toBeInstanceOf(CitationError);
  });

  it("sends the question and the answer schema, and the OpenRouter client asks for it as a strict json_schema", async () => {
    const client = new QuestionModelClient(adhesion, script);
    await answerQuestion(adhesion.text, CALIFORNIA, client);
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0].user).toContain(`Question: ${JSON.stringify(CALIFORNIA)}`);
    expect(client.requests[0].schemaName).toBe(ANSWER_SCHEMA_NAME);
    expect(client.requests[0].schema).toBe(ANSWER_SCHEMA);

    const bodies: unknown[] = [];
    const openRouter = createOpenRouterClient({
      env: { OPENROUTER_API_KEY: "test-key", OPENROUTER_MODEL: "vendor/model-from-env" },
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(init.body as string));
        const content = JSON.stringify({ outcome: "not-in-document", sentences: [], missingFacts: [] });
        return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }));
      },
    });
    expect(await answerQuestion(adhesion.text, PAY_DAY, openRouter)).toEqual({ outcome: "not-in-document" });
    const body = bodies[0] as { response_format: unknown; messages: { content: string }[] };
    expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: ANSWER_SCHEMA_NAME, strict: true, schema: ANSWER_SCHEMA } });
    expect(body.messages[1].content).toContain(JSON.stringify(PAY_DAY));
  });

  it("refuses a blank question without calling the model", async () => {
    const client = new QuestionModelClient(adhesion, script);
    await expect(answerQuestion(adhesion.text, " \n ", client)).rejects.toThrow(AnswerResponseError);
    expect(client.requests).toHaveLength(0);
  });
});

describe("answerQuestion over a Document read in parts", () => {
  /** Small enough that the fixture below needs several parts. */
  const BUDGET = 4_000;
  const late: Fixture = {
    text: `${clean.text}\n\n${clean.text}\n\n${clean.text}\n\n${planted("RF-1").sentence}\n`,
    sidecar: { ...clean.sidecar, document: "clean x3 + RF-1", plantedClauses: [planted("RF-1")] },
  };
  const lateScript: Record<string, ScriptedAnswer> = {
    [STOP_EARLY]: { outcome: "answered", sentences: [{ text: "You pay the Client's costs to finish the project.", tier: "read-off", cites: ["RF-1"] }] },
    [PAY_DAY]: { outcome: "not-in-document" },
    [CALIFORNIA]: { outcome: "needs-signer-facts", missingFacts: ["jurisdiction"], about: "RF-1" },
  };
  const askInParts = async (question: string) => {
    const client = new QuestionModelClient(late, lateScript);
    const answer = await answerQuestion(late.text, question, client, { partBudget: BUDGET });
    return { answer, client };
  };

  it("answers a question only the last part can answer, at full-text offsets", async () => {
    const { answer, client } = await askInParts(STOP_EARLY);

    expect(client.calls.length).toBeGreaterThan(1);
    expect(client.calls.slice(0, -1).every((call) => call.response.outcome === "not-in-document")).toBe(true);
    expect(answer.outcome).toBe("answered");
    if (answer.outcome !== "answered") return;
    expect(answer.sentences).toHaveLength(1);
    const [source] = answer.sentences[0].sources;
    expect(source.text).toBe(planted("RF-1").sentence);
    expect(late.text.slice(source.start, source.end)).toBe(source.text);
    expect(source.start).toBe(late.text.lastIndexOf(planted("RF-1").sentence));
  });

  it("says not-in-document only after every part said so", async () => {
    const { answer, client } = await askInParts(PAY_DAY);
    const units = segmentSentences(late.text);
    expect(client.calls.length).toBeGreaterThan(1);
    expect(new Set(client.calls.flatMap((call) => call.unitIds))).toEqual(new Set(units.map((unit) => unit.id)));
    expect(answer).toEqual({ outcome: "not-in-document" });
  });

  it("says needs-signer-facts when one part says so and none answers", async () => {
    const { answer, client } = await askInParts(CALIFORNIA);
    expect(client.calls.filter((call) => call.response.outcome === "needs-signer-facts")).toHaveLength(1);
    expect(answer).toEqual({ outcome: "needs-signer-facts", missingFacts: ["jurisdiction"] });
  });

  it("keeps a sentence read twice in the overlap between parts only once", async () => {
    const overlapFixture: Fixture = {
      text: `${clean.text}\n\n${planted("RF-1").sentence}\n\n${clean.text}\n`,
      sidecar: { ...clean.sidecar, document: "clean + RF-1 + clean", plantedClauses: [planted("RF-1")] },
    };
    const client = new QuestionModelClient(overlapFixture, lateScript);
    const units = segmentSentences(overlapFixture.text);
    const rf1 = units.find((unit) => unit.text === planted("RF-1").sentence)!;
    // At this budget the overlap repeats RF-1 at the start of the next part, so two parts answer.
    const answer = await answerQuestion(overlapFixture.text, STOP_EARLY, client, { partBudget: 3_600 });
    const answering = client.calls.filter((call) => call.response.outcome === "answered");
    expect(client.calls.filter((call) => call.unitIds.includes(rf1.id))).toHaveLength(2);
    expect(answering).toHaveLength(2);
    expect(answer.outcome).toBe("answered");
    if (answer.outcome !== "answered") return;
    expect(answer.sentences).toHaveLength(1);
    expect(answer.sentences[0].sources[0].start).toBe(rf1.start);
  });

  it("fails the whole answer when one part cites a unit it was not shown", async () => {
    const units = segmentSentences(late.text);
    const client = new QuestionModelClient(late, lateScript, {
      tamper: (payload) =>
        payload.outcome === "answered"
          ? { ...payload, sentences: payload.sentences.map((s) => ({ ...s, sources: [...s.sources, { unitId: units[0].id, quote: units[0].text }] })) }
          : payload,
    });
    await expect(answerQuestion(late.text, STOP_EARLY, client, { partBudget: BUDGET })).rejects.toThrow(/outside the part/);
  });
});
