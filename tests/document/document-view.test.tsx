// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { analyse } from "../../lib/analysis/analyse";
import { segmentSentences } from "../../lib/analysis/segment";
import type { AnalysisResult } from "../../lib/analysis/types";
import { DocumentView, riskFlagMarkId } from "../../app/(app)/app/DocumentView";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");
const repeated = (adhesion.sidecar as unknown as { repeatedSentence: string }).repeatedSentence;

afterEach(cleanup);

/** A real `analyse` result whose rank 1 Risk flag cites the second occurrence of the repeated sentence. */
async function resultCitingSecondOccurrence(): Promise<{ result: AnalysisResult; secondAt: number; firstAt: number }> {
  const occurrences = segmentSentences(adhesion.text).filter((unit) => unit.text === repeated);
  expect(occurrences).toHaveLength(2);
  const [first, second] = occurrences;
  const client = new SidecarModelClient(adhesion, (payload) => ({
    ...payload,
    riskFlags: payload.riskFlags.map((flag) =>
      flag.rank === 1 ? { ...flag, unitId: second.id, quote: second.text } : flag,
    ),
  }));
  const result = await analyse(adhesion.text, [], client);
  const flag = result.riskFlags.find((candidate) => candidate.rank === 1)!;
  expect(flag.source.text).toBe(repeated);
  return { result, firstAt: first.start, secondAt: second.start };
}

function renderView(result: AnalysisResult, pulled: string | null, onPull: (id: string) => void = () => {}) {
  return render(
    <DocumentView
      fileName="adhesion-contract.txt"
      text={adhesion.text}
      result={result}
      pulled={pulled}
      scrollRequest={0}
      onPull={onPull}
    />,
  );
}

describe("DocumentView", () => {
  it("tapes the occurrence of a repeated sentence that the flag's offsets point at, not the first", async () => {
    const { result, firstAt, secondAt } = await resultCitingSecondOccurrence();
    expect(secondAt).toBeGreaterThan(firstAt);
    const flag = result.riskFlags.find((candidate) => candidate.rank === 1)!;
    const { container } = renderView(result, riskFlagMarkId(flag));

    const taped = [...container.querySelectorAll<HTMLElement>("mark[data-pulled]")];
    expect(taped.map((mark) => mark.textContent).join("")).toBe(repeated);
    expect(Number(taped[0].dataset.start)).toBe(secondAt);

    const page = container.querySelector<HTMLElement>("[data-document-text]")!;
    const range = document.createRange();
    range.setStart(page, 0);
    range.setEndBefore(taped[0]);
    expect(range.toString()).toBe(adhesion.text.slice(0, secondAt));
    expect(range.toString().length).toBeGreaterThan(firstAt + repeated.length);

    const marksAtFirst = [...container.querySelectorAll<HTMLElement>("mark")].filter(
      (mark) => Number(mark.dataset.start) === firstAt,
    );
    expect(marksAtFirst).toEqual([]);
  });

  it("shows the stored text exactly, with nothing added by tabs or highlights", async () => {
    const { result } = await resultCitingSecondOccurrence();
    const { container } = renderView(result, "risk-flag-1");

    expect(container.querySelector("[data-document-text]")!.textContent).toBe(adhesion.text);
    expect(container.querySelector("[data-document-text]")!.parentElement!.textContent).toBe(adhesion.text);
  });

  it("puts one tab on the page per Risk flag, at distinct heights, and no Missing protection on the page", async () => {
    const { result } = await resultCitingSecondOccurrence();
    const { container } = renderView(result, "risk-flag-1");

    const tabs = [...container.querySelectorAll<HTMLElement>("[data-mark]")];
    expect(tabs.map((tab) => tab.dataset.rank).sort()).toEqual(result.riskFlags.map((flag) => String(flag.rank)).sort());
    expect(tabs.every((tab) => tab.getAttribute("aria-hidden") === "true")).toBe(true);
    const tops = tabs.map((tab) => parseFloat(tab.style.getPropertyValue("--y"))).sort((a, b) => a - b);
    for (let index = 1; index < tops.length; index += 1) {
      expect(tops[index] - tops[index - 1]).toBeGreaterThanOrEqual(30);
    }
    const text = container.textContent ?? "";
    for (const entry of result.missingProtections) {
      expect(text).not.toContain(entry.proposedInsertion);
      expect(text).not.toContain(entry.statement);
    }
  });

  it("underlines every Risk flag's sentence and pulls the one a tab selects", async () => {
    const { result } = await resultCitingSecondOccurrence();
    const pulls: string[] = [];
    const { container } = renderView(result, "risk-flag-1", (id) => pulls.push(id));

    for (const flag of result.riskFlags) {
      const covered = [...container.querySelectorAll<HTMLElement>("mark[data-flagged]")].filter((mark) =>
        mark.dataset.spans!.split(" ").includes(riskFlagMarkId(flag)),
      );
      expect(covered.map((mark) => mark.textContent).join("")).toBe(flag.source.text);
      expect(Number(covered[0].dataset.start)).toBe(flag.source.start);
    }

    fireEvent.click(container.querySelector('[data-mark="risk-flag-3"]')!);
    expect(pulls).toEqual(["risk-flag-3"]);
  });
});
