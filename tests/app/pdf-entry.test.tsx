// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalysePage from "../../app/(app)/app/page";
import { buildPdf, pdfString } from "../support/minimal-pdf.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function choose(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a .txt, PDF or Word file"), { target: { files: [file] } });
}

describe("the entry screen's file picker with a PDF", () => {
  it("refuses a scan plainly and never sends anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);
    const scan = buildPdf([{ content: "q 500 0 0 700 56 46 cm /Im1 Do Q", withImage: true }]);

    choose(new File([scan], "signed-lease.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("This looks like a scan")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Redline can't read signed-lease.pdf.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends only the extracted text of a text PDF", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ ok: false, code: "model-unavailable" }, { status: 502 }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);
    const content = `BT /F1 12 Tf 72 720 Td 14 TL ${pdfString("Fees are due")} Tj T* ${pdfString("on signing.")} Tj ET`;

    choose(new File([buildPdf([{ content }])], "fees.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("The analysis failed")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ text: "Fees are due\non signing.", redLines: [] });
  });

  it("says a damaged PDF can't be opened and sends nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    choose(new File(["not a pdf"], "broken.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("Couldn't read this file")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("This PDF won't open.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
