import { ModelError } from "./model-client.ts";
import type { JsonCompletionRequest, ModelClient } from "./model-client.ts";

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Enough room for a long Document's full analysis; a cut-off answer fails rather than parsing. */
const MAX_OUTPUT_TOKENS = 32_000;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface OpenRouterClientOptions {
  /** Where OPENROUTER_API_KEY and OPENROUTER_MODEL are read from. Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** The network boundary. Defaults to the global fetch. */
  fetch?: FetchLike;
}

/**
 * Production ModelClient: OpenRouter's OpenAI-compatible chat completions endpoint over plain
 * fetch. The model id comes only from OPENROUTER_MODEL. Server-side only: it reads the API key.
 *
 * The schema travels in the system prompt, not as `response_format`: Anthropic's providers refuse
 * the analysis schema as a constrained-decoding grammar ("compiled grammar is too large"). Nothing
 * is lost by that, because `analyse` and `answerQuestion` check every field and every quote of
 * the parsed answer themselves and reject anything that does not fit.
 */
export function createOpenRouterClient(options: OpenRouterClientOptions = {}): ModelClient {
  const env = options.env ?? process.env;
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim();
  const missing = [!apiKey && "OPENROUTER_API_KEY", !model && "OPENROUTER_MODEL"].filter(Boolean);
  if (missing.length > 0) {
    throw new ModelError(
      "not-configured",
      `OpenRouter is not configured: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set.`,
    );
  }
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));

  return {
    async completeJson(request: JsonCompletionRequest): Promise<unknown> {
      const body = {
        model,
        messages: [
          { role: "system", content: `${request.system}\n\n${schemaInstruction(request)}` },
          { role: "user", content: request.user },
        ],
        provider: { require_parameters: true },
        reasoning: { effort: "low" },
        max_tokens: MAX_OUTPUT_TOKENS,
      };

      let response: Response;
      try {
        response = await doFetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        throw new ModelError(
          "network",
          `OpenRouter request failed before a response arrived: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const raw = await response.text();
      if (!response.ok) {
        throw new ModelError(
          "http",
          `OpenRouter answered ${response.status} ${response.statusText}: ${describeErrorBody(raw)}`,
        );
      }

      let envelope: unknown;
      try {
        envelope = JSON.parse(raw);
      } catch {
        throw new ModelError("unparseable", `OpenRouter's response body is not JSON: ${snippet(raw)}`);
      }

      const choice = (envelope as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] })
        ?.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        const apiError = (envelope as { error?: { message?: unknown } })?.error?.message;
        throw new ModelError(
          "unparseable",
          typeof apiError === "string"
            ? `OpenRouter returned an error: ${apiError}`
            : `OpenRouter's response has no message content: ${snippet(raw)}`,
        );
      }
      if (choice?.finish_reason === "length") {
        throw new ModelError("unparseable", "The model's answer was cut off at its length limit.");
      }

      try {
        return JSON.parse(withoutCodeFence(content));
      } catch {
        throw new ModelError("unparseable", `The model's answer is not valid JSON: ${snippet(content)}`);
      }
    },
  };
}

function schemaInstruction(request: JsonCompletionRequest): string {
  return (
    "Output format: reply with nothing but one JSON object, no prose and no code fence. The object itself " +
    "must match this JSON Schema exactly, not be wrapped in another object: every required property present " +
    `at the top level, no other properties, every enum value spelled as listed.\n${JSON.stringify(request.schema)}`
  );
}

/** Models sometimes wrap JSON in a Markdown fence despite being told not to. */
function withoutCodeFence(content: string): string {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/.exec(content);
  return fenced ? fenced[1] : content;
}

function describeErrorBody(raw: string): string {
  try {
    const message = (JSON.parse(raw) as { error?: { message?: unknown } })?.error?.message;
    if (typeof message === "string") return message;
  } catch {
    // fall through to the raw snippet
  }
  return snippet(raw);
}

function snippet(text: string): string {
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
