import { analyse, AnalysisResponseError, CitationError } from "./analyse.ts";
import type { AnalyseFailureCode, AnalyseResponseBody } from "./api.ts";
import { isBlankDocument } from "./request.ts";
import type { RedLine } from "./types.ts";
import { ModelError } from "../model/model-client.ts";
import type { ModelClient } from "../model/model-client.ts";

/**
 * Handles POST /api/analyse. The model client is created per request by `createClient`, so the route
 * wires in OpenRouter and tests pass a stub. The Document's text reaches `analyse` exactly as it was
 * sent: blank input is refused by testing it, never by replacing it.
 */
export async function handleAnalyseRequest(request: Request, createClient: () => ModelClient): Promise<Response> {
  let text: unknown;
  let redLines: unknown;
  try {
    ({ text, redLines } = (await request.json()) as { text?: unknown; redLines?: unknown });
  } catch {
    return fail("bad-request", 400);
  }
  if (typeof text !== "string" || isBlankDocument(text) || !isRedLines(redLines)) {
    return fail("bad-request", 400);
  }

  try {
    const result = await analyse(text, redLines, createClient());
    return json({ ok: true, result }, 200);
  } catch (error) {
    // Log the reason for the operator; the browser gets a code only. Never log the key.
    console.error("[api/analyse]", error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (error instanceof CitationError) return fail("citation", 502);
    if (error instanceof ModelError) {
      return error.reason === "not-configured" ? fail("not-configured", 503) : fail("model-unavailable", 502);
    }
    if (error instanceof AnalysisResponseError) return fail("model-unavailable", 502);
    return fail("unexpected", 500);
  }
}

function isRedLines(value: unknown): value is RedLine[] {
  return Array.isArray(value) && value.every((item) => typeof item?.text === "string");
}

function fail(code: AnalyseFailureCode, status: number): Response {
  return json({ ok: false, code }, status);
}

function json(body: AnalyseResponseBody, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
