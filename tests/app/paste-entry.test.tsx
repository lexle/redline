// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalysePage from "../../app/(app)/app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the entry screen's paste box", () => {
  it("refuses whitespace-only text and sends nothing", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: "  \n\t  \n " } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    expect(screen.getByRole("alert").textContent).toBe("There's no text to check. Paste the document first.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends pasted text exactly as it was entered", async () => {
    const pasted = "\tThe Contractor shall pay  all costs.   \n\nFees are due on signing. ";
    const fetchSpy = vi.fn(async () => Response.json({ ok: false, code: "model-unavailable" }, { status: 502 }));
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: pasted } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    expect(await screen.findByText("The analysis failed")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/analyse");
    expect(JSON.parse(init.body as string)).toEqual({ text: pasted, redLines: [] });
  });

  it("says a long document is read in parts while it is checked, and shows only the failure if a part fails", async () => {
    const sentence = "The Contractor shall deliver the work described in the attached schedule on time. ";
    const pasted = sentence.repeat(1_500);
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))));
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: pasted } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    expect(screen.getByRole("status").textContent).toMatch(/It's long, so Redline reads it in [2-9] parts and shows nothing until every part is done/);
    answer(Response.json({ ok: false, code: "citation" }, { status: 502 }));
    expect(await screen.findByText("The analysis failed")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not mention parts for a document that fits in one request", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: "Fees are due on signing." } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    expect(screen.getByRole("status").textContent).toBe("Checking your pasted document. This can take a minute.");
  });
});
