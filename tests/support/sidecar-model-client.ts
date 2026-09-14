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
  /** Optional here only so tests can send a response that omits it; the product requires it. */
  counterOffer?: string;
}

export interface ModelWorthALook {
  unitId: string;
  quote: string;
  title: string;
  claims: ModelClaim[];
}

export interface ModelMultiplierNote {
  unitId: string;
  quote: string;
  title: string;
  claims: ModelClaim[];
}

export interface ModelPayload {
  riskFlags: ModelRiskFlag[];
  worthALook: ModelWorthALook[];
  multiplierNotes: ModelMultiplierNote[];
}

export interface SidecarClientOptions {
  /**
   * Claims appended to a planted clause's finding, keyed by the clause id in the sidecar (e.g. "RF-4"
   * or "WAL-1").
   */
  extraClaims?: Record<string, ModelClaim[]>;
  /** Planted clause ids whose flag is sent with no counterOffer field at all. */
  omitCounterOffer?: string[];
  /** Counter-offer text to send instead of the derived one, keyed by clause id (e.g. "" or "   "). */
  counterOffers?: Record<string, string>;
  /** Quote to send instead of the unit's exact text for a planted Worth a look, keyed by clause id. */
  worthALookQuotes?: Record<string, string>;
  /** Quote to send instead of the unit's exact text for a planted Multiplier note, keyed by clause id. */
  multiplierNoteQuotes?: Record<string, string>;
  /** Send the planted Multiplier notes with an empty riskFlags list, as a model would for a Document with no ranked harm. */
  onlyMultiplierNotes?: boolean;
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

/** The Counter-offer the stub gives each planted flag, built from the clause's id and type. */
export function counterOfferFor(clause: PlantedClause): string {
  return `${clause.id}: in place of the ${clause.clauseType.replace(/-/g, " ")} clause, the Contractor proposes the following wording, with its obligation limited to [amount].`;
}

/**
 * A synthetic ModelClient that answers the way a correct model would for a fixture: one Risk flag
 * per planted risk-flag sentence, one Worth a look entry per planted worth-a-look sentence and one
 * Multiplier note per planted multiplier-note sentence, citing the unit id the product's own segmenter gives it, with a
 * read-off claim and an inference claim built from the sidecar, then any test-supplied extras.
 * Flags are emitted in reverse rank order so ranking is exercised. Every request received is kept
 * in `requests`.
 */
export class SidecarModelClient implements ModelClient {
  readonly requests: JsonCompletionRequest[] = [];
  private readonly payload: ModelPayload;

  constructor(fixture: Fixture, options: SidecarClientOptions | SidecarClientOptions["tamper"] = {}) {
    const {
      extraClaims = {},
      omitCounterOffer = [],
      counterOffers = {},
      worthALookQuotes = {},
      multiplierNoteQuotes = {},
      onlyMultiplierNotes = false,
      tamper,
    } = typeof options === "function" ? { tamper: options } : options;
    const units = segmentSentences(fixture.text);
    const planted = fixture.sidecar.plantedClauses.filter((clause) => clause.findingType === "risk-flag");
    const plantedWorthALook = fixture.sidecar.plantedClauses.filter((clause) => clause.findingType === "worth-a-look");
    const plantedMultiplierNotes = fixture.sidecar.plantedClauses.filter(
      (clause) => clause.findingType === "multiplier-note",
    );
    for (const id of [...omitCounterOffer, ...Object.keys(counterOffers)]) {
      if (!planted.some((clause) => clause.id === id)) {
        throw new Error(`Options name ${id}, which is not a planted risk flag in ${fixture.sidecar.document}.`);
      }
    }
    for (const id of Object.keys(worthALookQuotes)) {
      if (!plantedWorthALook.some((clause) => clause.id === id)) {
        throw new Error(`Options name ${id}, which is not a planted worth-a-look clause in ${fixture.sidecar.document}.`);
      }
    }
    for (const id of Object.keys(multiplierNoteQuotes)) {
      if (!plantedMultiplierNotes.some((clause) => clause.id === id)) {
        throw new Error(`Options name ${id}, which is not a planted multiplier note in ${fixture.sidecar.document}.`);
      }
    }
    for (const id of Object.keys(extraClaims)) {
      if (![...planted, ...plantedWorthALook, ...plantedMultiplierNotes].some((clause) => clause.id === id)) {
        throw new Error(`Options name ${id}, which is not a planted cited clause in ${fixture.sidecar.document}.`);
      }
    }
    const unitFor = (clause: PlantedClause) => {
      const unit = units.find((candidate) => candidate.text === clause.sentence);
      if (!unit) {
        throw new Error(`Planted sentence ${clause.id} is not a single unit of ${fixture.sidecar.document}.`);
      }
      return unit;
    };
    const riskFlags = planted
      .map((clause): ModelRiskFlag => {
        const unit = unitFor(clause);
        if (clause.severityBand === null || clause.expectedRank === null) {
          throw new Error(`Planted risk flag ${clause.id} has no severity band or rank.`);
        }
        const flag: ModelRiskFlag = {
          unitId: unit.id,
          quote: unit.text,
          title: clause.id,
          claims: [readOffClaimFor(clause), inferenceClaimFor(clause), ...(extraClaims[clause.id] ?? [])],
          severityBand: clause.severityBand,
          rank: clause.expectedRank,
          counterOffer: counterOffers[clause.id] ?? counterOfferFor(clause),
        };
        if (omitCounterOffer.includes(clause.id)) delete flag.counterOffer;
        return flag;
      })
      .reverse();
    // Worth a look entries are sent in reverse document order, so the Document-order sort is exercised.
    const worthALook = plantedWorthALook
      .map((clause): ModelWorthALook => {
        const unit = unitFor(clause);
        return {
          unitId: unit.id,
          quote: worthALookQuotes[clause.id] ?? unit.text,
          title: clause.id,
          claims: [readOffClaimFor(clause), inferenceClaimFor(clause), ...(extraClaims[clause.id] ?? [])],
        };
      })
      .reverse();
    // Multiplier notes are sent in reverse document order too.
    const multiplierNotes = plantedMultiplierNotes
      .map((clause): ModelMultiplierNote => {
        const unit = unitFor(clause);
        return {
          unitId: unit.id,
          quote: multiplierNoteQuotes[clause.id] ?? unit.text,
          title: clause.id,
          claims: [readOffClaimFor(clause), inferenceClaimFor(clause), ...(extraClaims[clause.id] ?? [])],
        };
      })
      .reverse();
    const payload: ModelPayload = onlyMultiplierNotes
      ? { riskFlags: [], worthALook: [], multiplierNotes }
      : { riskFlags, worthALook, multiplierNotes };
    this.payload = tamper ? tamper(structuredClone(payload)) : payload;
  }

  async completeJson(request: JsonCompletionRequest): Promise<unknown> {
    this.requests.push(request);
    return structuredClone(this.payload);
  }
}
