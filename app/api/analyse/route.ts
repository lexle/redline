import { analyse, AnalysisResponseError, CitationError } from "../../../lib/analysis/analyse";
import type { AnalyseFailureCode, AnalyseResponseBody } from "../../../lib/analysis/api";
import type { RedLine } from "../../../lib/analysis/types";
import { ModelError } from "../../../lib/model/model-client";
import { createOpenRouterClient } from "../../../lib/model/openrouter-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  let text: unknown;
  let redLines: unknown;
  try {
    ({ text, redLines } = (await request.json()) as { text?: unknown; redLines?: unknown });
  } catch {
    return fail("bad-request", 400);
  }
  if (typeof text !== "string" || text.trim() === "" || !isRedLines(redLines)) {
    return fail("bad-request", 400);
  }

  try {
    const result = await analyse(text, redLines, createOpenRouterClient());
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
