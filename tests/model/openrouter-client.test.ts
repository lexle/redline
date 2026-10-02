import { describe, expect, it } from "vitest";
import { ModelError } from "../../lib/model/model-client";
import { createOpenRouterClient, OPENROUTER_CHAT_COMPLETIONS_URL } from "../../lib/model/openrouter-client";

const env = { OPENROUTER_API_KEY: "test-key", OPENROUTER_MODEL: "vendor/model-from-env" };
const request = {
  system: "system words",
  user: "user words",
  schemaName: "document_analysis",
  schema: { type: "object", properties: {}, required: [], additionalProperties: false },
};

function recordingFetch(respond: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  };
  return { calls, fetch };
}

function completion(content: string, finishReason = "stop") {
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finishReason }] }), {
    status: 200,
  });
}

describe("OpenRouter client", () => {
  it("sends the model from the environment, open provider routing, low reasoning and the schema in the system prompt", async () => {
    const { calls, fetch } = recordingFetch(() => completion('{"riskFlags":[]}'));
    const client = createOpenRouterClient({ env, fetch });

    await client.completeJson(request);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(OPENROUTER_CHAT_COMPLETIONS_URL);
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.model).toBe("vendor/model-from-env");
    expect(body.provider).toEqual({ require_parameters: true });
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.max_tokens).toBeGreaterThan(0);
    // Anthropic's providers refuse the analysis schema as a grammar, so it travels in the prompt.
    expect(body.response_format).toBeUndefined();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content.startsWith("system words\n\n")).toBe(true);
    expect(body.messages[0].content).toContain(JSON.stringify(request.schema));
    expect(body.messages[1]).toEqual({ role: "user", content: "user words" });
  });

  it("reads JSON the model wrapped in a Markdown code fence", async () => {
    const { fetch } = recordingFetch(() => completion('```json\n{"riskFlags":[{"unitId":"u3"}]}\n```'));
    const result = await createOpenRouterClient({ env, fetch }).completeJson(request);
    expect(result).toEqual({ riskFlags: [{ unitId: "u3" }] });
  });

  it("returns the parsed JSON from the message content", async () => {
    const { fetch } = recordingFetch(() => completion('{"riskFlags":[{"unitId":"u3"}]}'));
    const result = await createOpenRouterClient({ env, fetch }).completeJson(request);
    expect(result).toEqual({ riskFlags: [{ unitId: "u3" }] });
  });

  it.each([
    [{ OPENROUTER_MODEL: "vendor/model" }, /OPENROUTER_API_KEY/],
    [{ OPENROUTER_API_KEY: "key" }, /OPENROUTER_MODEL/],
    [{ OPENROUTER_API_KEY: "  ", OPENROUTER_MODEL: "" }, /OPENROUTER_API_KEY and OPENROUTER_MODEL/],
  ])("throws a clear error when configuration is missing (%o)", (partialEnv, message) => {
    const { calls, fetch } = recordingFetch(() => completion("{}"));
    expect(() => createOpenRouterClient({ env: partialEnv, fetch })).toThrow(message);
    expect(calls).toHaveLength(0);
  });

  it("throws with the status and OpenRouter's message on a non-2xx response", async () => {
    const { fetch } = recordingFetch(
      () => new Response(JSON.stringify({ error: { message: "No endpoints found" } }), { status: 404, statusText: "Not Found" }),
    );
    const failure = await createOpenRouterClient({ env, fetch })
      .completeJson(request)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ModelError);
    expect((failure as ModelError).reason).toBe("http");
    expect((failure as Error).message).toMatch(/404.*No endpoints found/);
  });

  it("throws when the message content is not JSON", async () => {
    const { fetch } = recordingFetch(() => completion("Here are the risks: none"));
    await expect(createOpenRouterClient({ env, fetch }).completeJson(request)).rejects.toThrow(/not valid JSON/);
  });

  it("throws when the answer was cut off at the length limit", async () => {
    const { fetch } = recordingFetch(() => completion('{"riskFlags":[', "length"));
    await expect(createOpenRouterClient({ env, fetch }).completeJson(request)).rejects.toThrow(/cut off/);
  });

  it("throws when the response has no message content", async () => {
    const { fetch } = recordingFetch(() => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(createOpenRouterClient({ env, fetch }).completeJson(request)).rejects.toThrow(/no message content/);
  });
});
