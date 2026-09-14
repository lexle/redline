import { ModelError } from "./model-client.ts";
import type { JsonCompletionRequest, ModelClient } from "./model-client.ts";

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

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
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true },
        reasoning: { effort: "low" },
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schemaName, strict: true, schema: request.schema },
        },
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
        return JSON.parse(content);
      } catch {
        throw new ModelError("unparseable", `The model's answer is not valid JSON: ${snippet(content)}`);
      }
    },
  };
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
