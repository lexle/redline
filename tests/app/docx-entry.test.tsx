// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalysePage from "../../app/(app)/app/page";
import { DOCX_TYPE, INLINE_PICTURE, buildDocx } from "../support/minimal-docx.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function choose(file: File) {
  fireEvent.change(screen.getByLabelText("Choose a .txt, PDF or Word file"), { target: { files: [file] } });
}

describe("the entry screen's file picker with a Word file", () => {
  it("says plainly that a Word file holding only a picture has no text, and never sends anything", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    choose(new File([buildDocx(`<w:p>${INLINE_PICTURE}</w:p>`)], "lease-photo.docx", { type: DOCX_TYPE }));

    expect(await screen.findByText("No text in this Word file")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Redline can't read lease-photo.docx.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends only the extracted text of a Word file", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ ok: false, code: "model-unavailable" }, { status: 502 }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);
    const body =
      `<w:p><w:r><w:t xml:space="preserve">Fees are  </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>due</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>on signing.</w:t></w:r></w:p>`;

    choose(new File([buildDocx(body)], "fees.docx", { type: DOCX_TYPE }));

    expect(await screen.findByText("The analysis failed")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ text: "Fees are  due\non signing.", redLines: [] });
  });

  it("says a damaged Word file won't open and sends nothing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    choose(new File(["not a word file"], "broken.docx", { type: DOCX_TYPE }));

    expect(await screen.findByText("Couldn't read this file")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("This Word file won't open.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
