import { handleQuestionRequest } from "../../../lib/question/handle-question";
import { createOpenRouterClient } from "../../../lib/model/openrouter-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function POST(request: Request): Promise<Response> {
  return handleQuestionRequest(request, () => createOpenRouterClient());
}
