import type { Answer } from "./types.ts";

/** Body of POST /api/question. Only the Document's text and the question are sent, never the file. */
export interface QuestionRequestBody {
  text: string;
  question: string;
}

export type QuestionFailureCode = "bad-request" | "not-configured" | "citation" | "model-unavailable" | "unexpected";

export type QuestionResponseBody = { ok: true; answer: Answer } | { ok: false; code: QuestionFailureCode };
