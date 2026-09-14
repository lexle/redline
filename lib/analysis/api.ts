import type { AnalysisResult, RedLine } from "./types.ts";

/** Body of POST /api/analyse. Only the Document's text is sent, never the file. */
export interface AnalyseRequestBody {
  text: string;
  redLines: RedLine[];
}

export type AnalyseFailureCode = "bad-request" | "not-configured" | "citation" | "model-unavailable" | "unexpected";

export type AnalyseResponseBody =
  | { ok: true; result: AnalysisResult }
  | { ok: false; code: AnalyseFailureCode };
