import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { JsonCompletionRequest, ModelClient } from "../../lib/model/model-client";
import { segmentSentences } from "../../lib/analysis/segment";
import { CHECK_IDS, isHarmCheck } from "../../lib/analysis/checks";
import type { CheckId, RiskFlagCheck } from "../../lib/analysis/checks";

export interface PlantedClause {
  id: string;
  findingType: string;
  clauseType: string;
  sentence: string;
  severityBand: "high" | "medium" | null;
  expectedRank: number | null;
  why: string;
}

export interface ExpectedMissingProtection {
  /** A protection kind, e.g. "payment-timing". */
  id: string;
  why: string;
}

export interface PresentProtection {
  id: string;
  sentence: string;
}

export interface Sidecar {
  document: string;
  plantedClauses: PlantedClause[];
  /** Sentences a clean fixture uses to address each protection. */
  presentProtections?: PresentProtection[];
  /** Absent from a fixture that addresses every protection. */
  expectedMissingProtections?: ExpectedMissingProtection[];
  /** Minor absences the fixture leaves out, keyed by Nice to have kind. */
  expectedNiceToHave?: ExpectedMissingProtection[];
}

/** The harm check each planted Risk flag's clause type falls under. */
export const CHECK_FOR_CLAUSE_TYPE: Record<string, RiskFlagCheck> = {
  "liability-for-completion-consequential-costs": "uncapped-liability",
  "uncapped-indemnification": "uncapped-liability",
  "personal-guarantee": "personal-guarantee",
  "non-compete-non-solicit": "non-compete",
  "overbroad-ip-assignment": "ip-overreach",
  "auto-renewal-with-hard-cancellation": "lock-in",
};

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
  check: string;
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

export interface ModelMissingProtection {
  protection: string;
  statement: string;
  claims: ModelClaim[];
  proposedInsertion: string;
  /** Never sent by a correct model; present only so tests can attach one. */
  unitId?: string;
  quote?: string;
}

export interface ModelSpan {
  unitId: string;
  quote: string;
}

export interface ModelSummarySentence {
  text: string;
  tier: ModelTier;
  sources: ModelSpan[];
}

/** Shaped like a Missing protection; never carries a unit id, quote or source from a correct model. */
export type ModelNiceToHave = ModelMissingProtection & { source?: unknown };

export interface ModelChecklistItem {
  check: string;
  outcome: string;
  unitId: string;
  quote: string;
  detail: string;
}

export interface ModelPayload {
  summary: ModelSummarySentence[];
  riskFlags: ModelRiskFlag[];
  worthALook: ModelWorthALook[];
  multiplierNotes: ModelMultiplierNote[];
  missingProtections: ModelMissingProtection[];
  niceToHave: ModelNiceToHave[];
  checklist: ModelChecklistItem[];
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
  /** Proposed insertion text to send instead of the derived one, keyed by protection kind (e.g. "" or "  "). */
  proposedInsertions?: Record<string, string>;
  /** Protection kinds sent a second time, as a duplicate entry at the end of the list. */
  duplicateProtections?: string[];
  /** Protection kinds whose Missing protection is sent with the unit id (and quote) of the Document's first sentence. */
  attachUnitIdTo?: string[];
  /** Send this quote instead of the unit's exact text for one span of one planned summary sentence. */
  summaryQuote?: { sentence: number; span: number; quote: string };
  /** Planned summary sentences (by position) sent with an empty sources list. */
  summaryWithoutSpans?: number[];
  /** Planned summary sentences (by position) tagged needs-signer-facts instead of read-off. */
  signerFactsSummary?: number[];
  /** Nice to have Proposed insertion text to send instead of the derived one, keyed by kind. */
  niceToHaveInsertions?: Record<string, string>;
  /** Expected Missing protection kinds also sent as a Nice to have of the same kind. */
  alsoNiceToHave?: string[];
  /**
   * Checks sent with the outcome that contradicts the findings: a flagged harm check as not-found
   * (or a not-found one as flagged), a missing protection check as present, citing the Document's
   * first sentence (or a present one as missing).
   */
  contradictChecklist?: string[];
  /** Quote to send instead of the unit's exact text for a checklist item that cites, keyed by check. */
  checklistQuotes?: Record<string, string>;
  /** Corrupt or reshape the payload before it is returned. */
  tamper?: (payload: ModelPayload) => ModelPayload;
}

export interface PlannedSummarySentence {
  text: string;
  /** The Document sentences it cites, in order. */
  sentences: string[];
}

/**
 * The summary the stub sends for a fixture, built from the sidecar: the first sentence cites one
 * sidecar sentence, the second cites the next two. The sidecar sentences are the planted clauses in
 * sidecar order, then any present protections.
 */
export function plannedSummary(fixture: Fixture): PlannedSummarySentence[] {
  const citable = [
    ...fixture.sidecar.plantedClauses.map((clause) => ({ id: clause.id, sentence: clause.sentence })),
    ...(fixture.sidecar.presentProtections ?? []),
  ];
  if (citable.length < 3) {
    throw new Error(`${fixture.sidecar.document} needs at least three sidecar sentences to plan a summary.`);
  }
  return [[citable[0]], [citable[1], citable[2]]].map((cited) => ({
    text: `The Document commits the Signer to what ${cited.map((entry) => entry.id).join(" and ")} say.`,
    sentences: cited.map((entry) => entry.sentence),
  }));
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

/** The statement the stub gives each expected Missing protection, built from its kind. */
export function statementFor(expected: ExpectedMissingProtection): string {
  return `The Document does not address ${expected.id.replace(/-/g, " ")}.`;
}

/** The inference claim the stub gives each expected Missing protection: the sidecar's reason it matters. */
export function inferenceClaimForAbsence(expected: ExpectedMissingProtection): ModelClaim {
  return { tier: "inference", text: expected.why };
}

/** The Proposed insertion the stub gives each expected Missing protection, built from its kind. */
export function proposedInsertionFor(expected: ExpectedMissingProtection): string {
  return `${expected.id}: the Client shall provide for ${expected.id.replace(/-/g, " ")} within [number] days.`;
}

/** The statement the stub gives each expected Nice to have, built from its kind. */
export function niceToHaveStatementFor(expected: ExpectedMissingProtection): string {
  return `The Document does not include ${expected.id.replace(/-/g, " ")}.`;
}

/** The Proposed insertion the stub gives each expected Nice to have, built from its kind. */
export function niceToHaveInsertionFor(expected: ExpectedMissingProtection): string {
  return `${expected.id}: the Designer may [describe ${expected.id.replace(/-/g, " ")}].`;
}

/** The detail the stub gives a checklist item that cites a sentence, built from its check. */
export function checklistDetailFor(check: string): string {
  return `The Document states ${check.replace(/-/g, " ")}.`;
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
      proposedInsertions = {},
      duplicateProtections = [],
      attachUnitIdTo = [],
      summaryQuote,
      summaryWithoutSpans = [],
      signerFactsSummary = [],
      niceToHaveInsertions = {},
      alsoNiceToHave = [],
      contradictChecklist = [],
      checklistQuotes = {},
      tamper,
    } = typeof options === "function" ? { tamper: options } : options;
    const expectedNiceToHave = fixture.sidecar.expectedNiceToHave ?? [];
    for (const kind of Object.keys(niceToHaveInsertions)) {
      if (!expectedNiceToHave.some((expected) => expected.id === kind)) {
        throw new Error(`Options name ${kind}, which is not an expected nice to have in ${fixture.sidecar.document}.`);
      }
    }
    for (const check of contradictChecklist) {
      if (!CHECK_IDS.includes(check as CheckId)) throw new Error(`Options name ${check}, which is not a check.`);
    }
    const expectedMissing = fixture.sidecar.expectedMissingProtections ?? [];
    for (const kind of [...Object.keys(proposedInsertions), ...duplicateProtections, ...attachUnitIdTo, ...alsoNiceToHave]) {
      if (!expectedMissing.some((expected) => expected.id === kind)) {
        throw new Error(`Options name ${kind}, which is not an expected missing protection in ${fixture.sidecar.document}.`);
      }
    }
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
        const check = CHECK_FOR_CLAUSE_TYPE[clause.clauseType];
        if (!check) throw new Error(`Planted risk flag ${clause.id} has a clause type with no harm check.`);
        const flag: ModelRiskFlag = {
          unitId: unit.id,
          quote: unit.text,
          title: clause.id,
          check,
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
    // Missing protections are sent in reverse sidecar order, so payment timing and amount arrive last
    // and the payment-first sort is exercised.
    const missingProtections = expectedMissing
      .map((expected): ModelMissingProtection => {
        const entry: ModelMissingProtection = {
          protection: expected.id,
          statement: statementFor(expected),
          claims: [inferenceClaimForAbsence(expected)],
          proposedInsertion: proposedInsertions[expected.id] ?? proposedInsertionFor(expected),
        };
        if (attachUnitIdTo.includes(expected.id)) {
          entry.unitId = units[0].id;
          entry.quote = units[0].text;
        }
        return entry;
      })
      .reverse();
    for (const kind of duplicateProtections) {
      missingProtections.push(structuredClone(missingProtections.find((entry) => entry.protection === kind)!));
    }
    const planned = plannedSummary(fixture);
    for (const position of [...summaryWithoutSpans, ...signerFactsSummary, ...(summaryQuote ? [summaryQuote.sentence] : [])]) {
      if (!planned[position]) throw new Error(`Options name summary sentence ${position}, which is not planned.`);
    }
    if (summaryQuote && !planned[summaryQuote.sentence].sentences[summaryQuote.span]) {
      throw new Error(`Summary sentence ${summaryQuote.sentence} has no span ${summaryQuote.span}.`);
    }
    const summary = planned.map((sentence, position): ModelSummarySentence => ({
      text: sentence.text,
      tier: signerFactsSummary.includes(position) ? "needs-signer-facts" : "read-off",
      sources: summaryWithoutSpans.includes(position)
        ? []
        : sentence.sentences.map((text, span) => {
            const unit = units.find((candidate) => candidate.text === text);
            if (!unit) throw new Error(`Summary sentence ${position} cites text that is not a single unit.`);
            const tampered = summaryQuote?.sentence === position && summaryQuote.span === span;
            return { unitId: unit.id, quote: tampered ? summaryQuote.quote : unit.text };
          }),
    }));
    const niceToHave = expectedNiceToHave.map(
      (expected): ModelNiceToHave => ({
        protection: expected.id,
        statement: niceToHaveStatementFor(expected),
        claims: [inferenceClaimForAbsence(expected)],
        proposedInsertion: niceToHaveInsertions[expected.id] ?? niceToHaveInsertionFor(expected),
      }),
    );
    for (const kind of alsoNiceToHave) {
      const expected = expectedMissing.find((entry) => entry.id === kind)!;
      niceToHave.push({
        protection: kind,
        statement: niceToHaveStatementFor(expected),
        claims: [],
        proposedInsertion: niceToHaveInsertionFor(expected),
      });
    }

    const sentFlags = onlyMultiplierNotes ? [] : riskFlags;
    // The checklist a correct model would send for these findings: a harm check is flagged exactly
    // when a sent flag names it, and a protection check is missing exactly when a sent absence has
    // its kind. A present protection cites the sidecar sentence that states it.
    const absentKinds = new Set([...missingProtections, ...niceToHave].map((entry) => entry.protection));
    const uncited = { unitId: "", quote: "", detail: "" };
    const checklist = CHECK_IDS.map((check): ModelChecklistItem => {
      const contradict = contradictChecklist.includes(check);
      if (isHarmCheck(check)) {
        const flagged = sentFlags.some((flag) => flag.check === check);
        return { check, outcome: flagged !== contradict ? "flagged" : "not-found", ...uncited };
      }
      if (absentKinds.has(check) !== contradict) return { check, outcome: "missing", ...uncited };
      const present = fixture.sidecar.presentProtections?.find((entry) => entry.id === check);
      const unit = present ? units.find((candidate) => candidate.text === present.sentence) : contradict ? units[0] : undefined;
      if (!unit) throw new Error(`${fixture.sidecar.document} has no single-unit sentence stating ${check}.`);
      return { check, outcome: "present", unitId: unit.id, quote: checklistQuotes[check] ?? unit.text, detail: checklistDetailFor(check) };
    });
    for (const check of Object.keys(checklistQuotes)) {
      if (!checklist.some((item) => item.check === check && item.outcome === "present")) {
        throw new Error(`Options name ${check}, which is not a checklist item that cites a sentence.`);
      }
    }

    const payload: ModelPayload = onlyMultiplierNotes
      ? { summary, riskFlags: [], worthALook: [], multiplierNotes, missingProtections, niceToHave, checklist }
      : { summary, riskFlags, worthALook, multiplierNotes, missingProtections, niceToHave, checklist };
    this.payload = tamper ? tamper(structuredClone(payload)) : payload;
  }

  async completeJson(request: JsonCompletionRequest): Promise<unknown> {
    this.requests.push(request);
    return structuredClone(this.payload);
  }
}
