// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import LibraryPage from "../../app/(app)/library/page";
import { SavedDocument } from "../../app/(app)/library/[id]/SavedDocument";
import AnalysePage from "../../app/(app)/app/page";
import { analyse } from "../../lib/analysis/analyse";
import type { AnalysisResult } from "../../lib/analysis/types";
import { handleAnalyseRequest } from "../../lib/analysis/handle-analyse";
import { buildSavedDocument } from "../../lib/library/payload";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");

let result: AnalysisResult;

beforeAll(async () => {
  result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.localStorage.clear();
});

/** Answers /api/analyse through the real handler with the sidecar stub; records every other request. */
function analyseOnlyFetch() {
  const client = new SidecarModelClient(adhesion);
  return vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href === "/api/analyse") return handleAnalyseRequest(new Request(`http://localhost${href}`, init), () => client);
    return Promise.resolve(Response.json({ unexpected: href }, { status: 599 }));
  });
}

async function pasteAndCheck() {
  fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: adhesion.text } });
  fireEvent.click(screen.getByRole("button", { name: "Check this text" }));
  expect(await screen.findByText(/6 risk flags in your pasted document/)).toBeTruthy();
}

describe("the library with accounts not set up", () => {
  it("says so, lists nothing, and makes no network call", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<LibraryPage />);

    expect(screen.getByRole("heading", { name: "Library" })).toBeTruthy();
    expect(screen.getByText(/Accounts aren.t set up on this server yet/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Saved documents" })).toBeNull();
    expect(screen.getByRole("link", { name: "Check a document" }).getAttribute("href")).toBe("/app");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("saving from the result screen", () => {
  it("with accounts not set up, shows the result and says nothing about saving", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const fetchSpy = analyseOnlyFetch();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    await pasteAndCheck();

    expect(screen.queryByText(/library/i)).toBeNull();
    expect(screen.queryByText(/saved/i)).toBeNull();
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual(["/api/analyse"]);
  });

  it("signed out, saves nothing, sends nothing to Supabase, and says signing in keeps documents", async () => {
    // A real Supabase client pointed at an address nothing listens on, with no session stored in
    // the browser. Nothing about auth is faked: the client reads its own (empty) session.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-test");
    const fetchSpy = analyseOnlyFetch();
    vi.stubGlobal("fetch", fetchSpy);
    render(<AnalysePage />);

    await pasteAndCheck();

    expect(await screen.findByText(/Not saved, because you.re not signed in/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in");
    expect(screen.getByText(/6 risk flags in your pasted document/)).toBeTruthy();
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual(["/api/analyse"]);
  });
});

describe("a reopened saved Document", () => {
  const row = () => ({
    ...JSON.parse(JSON.stringify(buildSavedDocument("adhesion-contract.txt", adhesion.text, result))),
    id: "3f1c2b9e-7a44-4d0b-9a8e-2c5d1e6f7a80",
    created_at: "2026-09-14T12:30:00.000+00:00",
  });

  it("shows the stored result with the same result layout as a fresh analysis", () => {
    render(<SavedDocument row={row()} />);

    expect(screen.getByRole("heading", { level: 1, name: "adhesion-contract.txt" })).toBeTruthy();
    expect(screen.getByText("Saved Sep 14, 2026")).toBeTruthy();
    expect(screen.getByText(/6 risk flags in adhesion-contract.txt, most likely to cost you first/)).toBeTruthy();
    const flagCard = screen.getByRole("button", { name: /^Risk flag 1:/ }).closest("li")!;
    expect(flagCard.querySelector("blockquote")?.textContent).toBe(`“${result.riskFlags[0].source.text}”`);
    expect(document.querySelector("[data-document-text]")?.textContent).toBe(adhesion.text);
  });

  it("shows only a failure when the stored text no longer matches a quote", () => {
    const tampered = row();
    const at = result.riskFlags[0].source.start + 4;
    tampered.text = tampered.text.slice(0, at) + (tampered.text[at] === "X" ? "Y" : "X") + tampered.text.slice(at + 1);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SavedDocument row={tampered} />);
    consoleError.mockRestore();

    expect(screen.getByRole("alert").textContent).toMatch(/no longer matches the saved text word for word/);
    expect(screen.queryByText(/risk flags? in/)).toBeNull();
    expect(screen.queryByText(/Summary of/)).toBeNull();
    expect(document.querySelector("[data-document-text]")).toBeNull();
  });

  it("shows only a failure when the stored result is malformed", () => {
    const malformed = row();
    delete malformed.result.riskFlags;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SavedDocument row={malformed} />);
    consoleError.mockRestore();

    expect(screen.getByRole("alert").textContent).toMatch(/damaged or incomplete/);
    expect(screen.queryByText(/Summary of/)).toBeNull();
  });
});
