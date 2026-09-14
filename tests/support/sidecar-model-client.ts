import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JsonCompletionRequest, ModelClient } from "../../lib/model/model-client";
import { segmentSentences } from "../../lib/analysis/segment";

export interface PlantedClause {
  id: string;
  findingType: string;
  clauseType: string;
  sentence: string;
  severityBand: "high" | "medium" | null;
  expectedRank: number | null;
  why: string;
}

export interface Sidecar {
  document: string;
  plantedClauses: PlantedClause[];
}

export interface Fixture {
  text: string;
  sidecar: Sidecar;
}

const FIXTURES = join(__dirname, "..", "fixtures");

export function loadFixture(name: "adhesion-contract" | "clean-agreement"): Fixture {
  return {
    text: readFileSync(join(FIXTURES, `${name}.txt`), "utf8"),
    sidecar: JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as Sidecar,
  };
}

export type ModelTier = "read-off" | "inference" | "needs-signer-facts";

export interface ModelClaim {
  tier: ModelTier;
  text: string;
}

export interface ModelRiskFlag {
  unitId: string;
  quote: string;
  title: string;
  claims: ModelClaim[];
  severityBand: "high" | "medium";
  rank: number;
}

export interface ModelPayload {
  riskFlags: ModelRiskFlag[];
}

export interface SidecarClientOptions {
  /** Claims appended to a planted clause's flag, keyed by the clause id in the sidecar (e.g. "RF-4"). */
  extraClaims?: Record<string, ModelClaim[]>;
  /** Corrupt or reshape the payload before it is returned. */
  tamper?: (payload: ModelPayload) => ModelPayload;
}

/** The read-off claim the stub gives each planted flag: the clause's type, taken from the sidecar. */
export function readOffClaimFor(clause: PlantedClause): ModelClaim {
  return { tier: "read-off", text: `This sentence is a ${clause.clauseType.replace(/-/g, " ")} clause.` };
}

/** The inference claim the stub gives each planted flag: the sidecar's reason the clause bites. */
export function inferenceClaimFor(clause: PlantedClause): ModelClaim {
  return { tier: "inference", text: clause.why };
}

/**
 * A synthetic ModelClient that answers the way a correct model would for a fixture: one Risk flag
 * per planted risk-flag sentence, citing the unit id the product's own segmenter gives it, with a
 * read-off claim and an inference claim built from the sidecar, then any test-supplied extras.
 * Flags are emitted in reverse rank order so ranking is exercised. Every request received is kept
 * in `requests`.
 */
export class SidecarModelClient implements ModelClient {
  readonly requests: JsonCompletionRequest[] = [];
  private readonly payload: ModelPayload;

  constructor(fixture: Fixture, options: SidecarClientOptions | SidecarClientOptions["tamper"] = {}) {
    const { extraClaims = {}, tamper } = typeof options === "function" ? { tamper: options } : options;
    const units = segmentSentences(fixture.text);
    const planted = fixture.sidecar.plantedClauses.filter((clause) => clause.findingType === "risk-flag");
    for (const id of Object.keys(extraClaims)) {
      if (!planted.some((clause) => clause.id === id)) {
        throw new Error(`Extra claims name ${id}, which is not a planted risk flag in ${fixture.sidecar.document}.`);
      }
    }
    const riskFlags = planted
      .map((clause): ModelRiskFlag => {
        const unit = units.find((candidate) => candidate.text === clause.sentence);
        if (!unit) {
          throw new Error(`Planted sentence ${clause.id} is not a single unit of ${fixture.sidecar.document}.`);
        }
        if (clause.severityBand === null || clause.expectedRank === null) {
          throw new Error(`Planted risk flag ${clause.id} has no severity band or rank.`);
        }
        return {
          unitId: unit.id,
          quote: unit.text,
          title: clause.id,
          claims: [readOffClaimFor(clause), inferenceClaimFor(clause), ...(extraClaims[clause.id] ?? [])],
          severityBand: clause.severityBand,
          rank: clause.expectedRank,
        };
      })
      .reverse();
    const payload = { riskFlags };
    this.payload = tamper ? tamper(structuredClone(payload)) : payload;
  }

  async completeJson(request: JsonCompletionRequest): Promise<unknown> {
    this.requests.push(request);
    return structuredClone(this.payload);
  }
}
