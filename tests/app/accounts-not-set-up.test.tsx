// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import RedLinesPage from "../../app/(app)/red-lines/page";
import SignInPage from "../../app/(app)/sign-in/page";
import AnalysePage from "../../app/(app)/app/page";
import { analyse } from "../../lib/analysis/analyse";
import { handleAnalyseRequest } from "../../lib/analysis/handle-analyse";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");

beforeEach(() => {
  // Accounts not set up: both Supabase variables absent.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("with accounts not set up", () => {
  it("the sign-in screen says so, offers no email form, and makes no network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<SignInPage />);

    expect(screen.getByText(/Accounts aren.t set up on this server yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(screen.getByRole("link", { name: "Check a document" }).getAttribute("href")).toBe("/app");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the red lines screen says so, offers no editor, and makes no network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<RedLinesPage />);

    expect(screen.getByText(/Accounts aren.t set up on this server yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Add a red line")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the result screen still analyses a pasted Document, with no red lines", async () => {
    const client = new SidecarModelClient(adhesion);
    const fetchSpy = vi.fn((url: string, init: RequestInit) =>
      handleAnalyseRequest(new Request(`http://localhost${url}`, init), () => client),
    );
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: adhesion.text } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    expect(await screen.findByText(/6 risk flags in your pasted document/)).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/analyse");
    expect(JSON.parse(init.body as string).redLines).toEqual([]);
    expect(client.requests[0].user).toContain("The Signer has not stated any red lines.");
    expect(screen.queryByText(/Crosses your red line/)).toBeNull();
    expect(screen.queryByText(/Checked against your/)).toBeNull();
  });
});

describe("a Risk flag that crosses a red line", () => {
  it("shows which red line, quoting the Signer's words", async () => {
    const redLine = { text: "No non-compete that stops me working for other clients." };
    const result = await analyse(adhesion.text, [redLine], new SidecarModelClient(adhesion, { redLinesFor: { "RF-4": ["RL-1"] } }));
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, result })));
    render(<AnalysePage />);

    fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: adhesion.text } });
    fireEvent.click(screen.getByRole("button", { name: "Check this text" }));

    const label = await screen.findByText("Crosses your red line");
    const flag = label.closest("li")!;
    expect(within(flag).getByText(`“${redLine.text}”`)).toBeTruthy();
    expect(within(flag).getByText(/RF-4/, { selector: "button" })).toBeTruthy();
    expect(screen.getAllByText("Crosses your red line")).toHaveLength(1);
  });
});
