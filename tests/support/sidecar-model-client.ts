import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JsonCompletionRequest, ModelClient } from "../../lib/model/model-client";
import { segmentSentences } from "../../lib/analysis/segment";

export interface PlantedClause {
  id: string;
  findingType: string;
  sentence: string;
  severityBand: "high" | "medium" | null;
  expectedRank: number | null;
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

export interface ModelRiskFlag {
  unitId: string;
  quote: string;
  title: string;
  explanation: string;
  severityBand: "high" | "medium";
  rank: number;
}

export interface ModelPayload {
  riskFlags: ModelRiskFlag[];
}

/**
 * A synthetic ModelClient that answers the way a correct model would for a fixture: one Risk flag
 * per planted risk-flag sentence, citing the unit id the product's own segmenter gives it.
 * Flags are emitted in reverse rank order so ranking is exercised. `tamper` lets a test corrupt
 * the payload before it is returned. Every request received is kept in `requests`.
 */
export class SidecarModelClient implements ModelClient {
  readonly requests: JsonCompletionRequest[] = [];
  private readonly payload: ModelPayload;

  constructor(fixture: Fixture, tamper?: (payload: ModelPayload) => ModelPayload) {
    const units = segmentSentences(fixture.text);
    const riskFlags = fixture.sidecar.plantedClauses
      .filter((clause) => clause.findingType === "risk-flag")
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
          explanation: `Planted clause ${clause.id}.`,
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
