import { describe, expect, it, vi } from "vitest";
import { handleQuestionRequest } from "../../lib/question/handle-question";
import type { QuestionResponseBody } from "../../lib/question/api";
import { loadFixture } from "../support/sidecar-model-client";
import { QuestionModelClient } from "../support/question-model-client";

const adhesion = loadFixture("adhesion-contract");
const QUESTION = "Which day of the month am I paid?";

function questionRequest(body: unknown): Request {
  return new Request("http://localhost/api/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/question handler", () => {
  it.each([
    ["a blank question", { text: adhesion.text, question: "  \n\t" }],
    ["no question", { text: adhesion.text }],
    ["blank Document text", { text: " \r\n ", question: QUESTION }],
    ["a body that is not JSON", "not json"],
  ])("refuses %s as bad input without creating a model client", async (_name, body) => {
    const createClient = vi.fn(() => new QuestionModelClient(adhesion, {}));
    const response = await handleQuestionRequest(questionRequest(body), createClient);

    expect(response.status).toBe(400);
    expect((await response.json()) as QuestionResponseBody).toEqual({ ok: false, code: "bad-request" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the answer for a question the Document does not answer", async () => {
    const client = new QuestionModelClient(adhesion, { [QUESTION]: { outcome: "not-in-document" } });
    const response = await handleQuestionRequest(questionRequest({ text: adhesion.text, question: QUESTION }), () => client);

    expect(response.status).toBe(200);
    expect((await response.json()) as QuestionResponseBody).toEqual({ ok: true, answer: { outcome: "not-in-document" } });
  });

  it("reports a mismatched quote as a citation failure", async () => {
    const question = "What happens if I stop early?";
    const client = new QuestionModelClient(
      adhesion,
      { [question]: { outcome: "answered", sentences: [{ text: "You pay completion costs.", tier: "read-off", cites: ["RF-1"] }] } },
      { tamperQuote: { sentence: 0, span: 0, quote: "Something else." } },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleQuestionRequest(questionRequest({ text: adhesion.text, question }), () => client);

    expect(response.status).toBe(502);
    expect((await response.json()) as QuestionResponseBody).toEqual({ ok: false, code: "citation" });
  });
});
