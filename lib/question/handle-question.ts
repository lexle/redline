import { CitationError } from "../analysis/citation.ts";
import { isBlankDocument } from "../analysis/request.ts";
import { ModelError } from "../model/model-client.ts";
import type { ModelClient } from "../model/model-client.ts";
import { answerQuestion, AnswerResponseError } from "./answer.ts";
import type { QuestionFailureCode, QuestionResponseBody } from "./api.ts";

/**
 * Handles POST /api/question. The model client is created per request by `createClient`, so the
 * route wires in OpenRouter and tests pass a stub. Blank Document text or a blank question is refused
 * as bad input before any client is created.
 */
export async function handleQuestionRequest(request: Request, createClient: () => ModelClient): Promise<Response> {
  let text: unknown;
  let question: unknown;
  try {
    ({ text, question } = (await request.json()) as { text?: unknown; question?: unknown });
  } catch {
    return fail("bad-request", 400);
  }
  if (typeof text !== "string" || isBlankDocument(text) || typeof question !== "string" || question.trim() === "") {
    return fail("bad-request", 400);
  }

  try {
    const answer = await answerQuestion(text, question, createClient());
    return json({ ok: true, answer }, 200);
  } catch (error) {
    // Log the reason for the operator; the browser gets a code only. Never log the key.
    console.error("[api/question]", error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (error instanceof CitationError) return fail("citation", 502);
    if (error instanceof ModelError) {
      return error.reason === "not-configured" ? fail("not-configured", 503) : fail("model-unavailable", 502);
    }
    if (error instanceof AnswerResponseError) return fail("model-unavailable", 502);
    return fail("unexpected", 500);
  }
}

function fail(code: QuestionFailureCode, status: number): Response {
  return json({ ok: false, code }, status);
}

function json(body: QuestionResponseBody, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
