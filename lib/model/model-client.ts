/**
 * The one thing the analysis needs from a language model: send a system prompt and a user prompt,
 * demand JSON that fits a schema, and get the parsed JSON back.
 *
 * `analyse` receives an implementation as a parameter and never imports one.
 */

export type JsonSchema = { [key: string]: unknown };

export interface JsonCompletionRequest {
  system: string;
  user: string;
  /** Name sent with the structured-output request, e.g. "risk_flags". */
  schemaName: string;
  schema: JsonSchema;
}

export interface ModelClient {
  completeJson(request: JsonCompletionRequest): Promise<unknown>;
}

/** The model could not be called, or it answered with something that is not usable JSON. */
export class ModelError extends Error {
  readonly reason: "not-configured" | "http" | "unparseable" | "network";

  constructor(reason: ModelError["reason"], message: string) {
    super(message);
    this.name = "ModelError";
    this.reason = reason;
  }
}
