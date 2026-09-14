import { handleAnalyseRequest } from "../../../lib/analysis/handle-analyse";
import { createOpenRouterClient } from "../../../lib/model/openrouter-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function POST(request: Request): Promise<Response> {
  return handleAnalyseRequest(request, () => createOpenRouterClient());
}
