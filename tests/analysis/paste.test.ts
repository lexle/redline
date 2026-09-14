import { describe, expect, it } from "vitest";
import { handleAnalyseRequest } from "../../lib/analysis/handle-analyse";
import { buildAnalyseRequestBody, isBlankDocument } from "../../lib/analysis/request";
import { segmentSentences } from "../../lib/analysis/segment";
import type { AnalyseResponseBody } from "../../lib/analysis/api";
import { POST } from "../../app/api/analyse/route";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");

/**
 * The adhesion contract as a Signer might paste it from a word processor: CRLF line endings, a tab
 * opening every paragraph, double spaces after sentences and trailing spaces on every line.
 */
const messy = adhesion.text
  .replace(/\. (?=[A-Z])/g, ".  ")
  .split("\n")
  .map((line) => (line === "" ? line : `\t${line}   `))
  .join("\r\n");

function analyseRequest(body: string): Request {
  return new Request("http://localhost/api/analyse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("pasted Document text", () => {
  it("has the irregular whitespace the tests below rely on", () => {
    expect(messy).toContain("\r\n");
    expect(messy).toContain("\t");
    expect(messy).toContain(".  ");
    expect(messy).toMatch(/ {3}\r\n/);
  });

  it("survives the request body byte for byte", () => {
    const parsed = JSON.parse(buildAnalyseRequestBody(messy, [{ text: "No personal guarantee" }])) as {
      text: string;
      redLines: { text: string }[];
    };
    expect(parsed.text).toBe(messy);
    expect(Buffer.from(parsed.text, "utf8").equals(Buffer.from(messy, "utf8"))).toBe(true);
    expect(parsed.redLines).toEqual([{ text: "No personal guarantee" }]);
  });

  it("reaches analyse unchanged through the route handler", async () => {
    const client = new SidecarModelClient({ text: messy, sidecar: adhesion.sidecar });
    const response = await handleAnalyseRequest(analyseRequest(buildAnalyseRequestBody(messy, [])), () => client);
    const payload = (await response.json()) as AnalyseResponseBody;

    expect(response.status).toBe(200);
    if ("code" in payload) throw new Error(`analysis failed with ${payload.code}`);

    // The prompt the model saw shows every unit of the CRLF text, escaped, and nothing re-spaced.
    expect(client.requests).toHaveLength(1);
    const units = segmentSentences(messy);
    for (const unit of units) {
      expect(unit.text).toBe(messy.slice(unit.start, unit.end));
      expect(client.requests[0].user).toContain(JSON.stringify(unit.text));
    }

    // Every citation in the response points into the original CRLF text.
    const sources = [
      ...payload.result.riskFlags.map((flag) => flag.source),
      ...payload.result.summary.flatMap((sentence) => sentence.sources),
    ];
    expect(payload.result.riskFlags.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(messy.slice(source.start, source.end)).toBe(source.text);
    }
    const planted = adhesion.sidecar.plantedClauses.filter((clause) => clause.findingType === "risk-flag");
    expect(payload.result.riskFlags.map((flag) => flag.source.text).sort()).toEqual(
      planted.map((clause) => clause.sentence).sort(),
    );
  });

  it("is refused when it holds only whitespace", async () => {
    for (const blank of ["", " ", "\r\n\t  \r\n", " \n"]) {
      expect(isBlankDocument(blank)).toBe(true);
    }
    expect(isBlankDocument(" a ")).toBe(false);

    let clientCreated = false;
    const response = await handleAnalyseRequest(analyseRequest(buildAnalyseRequestBody("\r\n\t  \r\n", [])), () => {
      clientCreated = true;
      throw new Error("no model client should be created for blank input");
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "bad-request" });
    expect(clientCreated).toBe(false);

    const routeResponse = await POST(analyseRequest(buildAnalyseRequestBody("   \t\r\n", [])));
    expect(routeResponse.status).toBe(400);
    expect(await routeResponse.json()).toEqual({ ok: false, code: "bad-request" });
  });
});
