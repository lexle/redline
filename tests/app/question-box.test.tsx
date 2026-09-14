// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QuestionBox } from "../../app/(app)/app/QuestionBox";
import type { QuestionResponseBody } from "../../lib/question/api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TEXT = "The Client may end this Agreement at any time. Fees are due on signing.";

function answering(...bodies: { body: QuestionResponseBody; status?: number }[]) {
  const fetchSpy = vi.fn(async () => {
    const next = bodies.shift()!;
    return Response.json(next.body, { status: next.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function askQuestion(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
}

describe("the question box", () => {
  it("shows a question the Document doesn't answer as a plain statement, not an error", async () => {
    const fetchSpy = answering({ body: { ok: true, answer: { outcome: "not-in-document" } } });
    render(<QuestionBox fileName="your pasted document" text={TEXT} />);

    askQuestion("When am I paid?");

    const statement = await screen.findByText("Nothing in your document answers this.");
    expect(statement.closest("[role=alert]")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/couldn.t answer/)).toBeNull();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/question");
    expect(JSON.parse(init.body as string)).toEqual({ text: TEXT, question: "When am I paid?" });
  });

  it("names the facts about the Signer an answer depends on", async () => {
    answering({ body: { ok: true, answer: { outcome: "needs-signer-facts", missingFacts: ["jurisdiction", "leverage"] } } });
    render(<QuestionBox fileName="lease.pdf" text={TEXT} />);

    askQuestion("Is this enforceable in California?");

    expect(
      await screen.findByText(
        "The answer depends on the law where you work and how much bargaining power you have. Redline doesn't know that about you and won't guess.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows answered sentences with their quotes on request, marks inference, and keeps earlier questions in order", async () => {
    const source = { start: 0, end: 46, text: TEXT.slice(0, 46) };
    answering(
      {
        body: {
          ok: true,
          answer: {
            outcome: "answered",
            sentences: [
              { tier: "read-off", text: "The Client can end the agreement whenever it wants.", sources: [source] },
              { tier: "inference", text: "Work could stop without warning.", sources: [source] },
            ],
          },
        },
      },
      { body: { ok: false, code: "citation" }, status: 502 },
    );
    render(<QuestionBox fileName="lease.pdf" text={TEXT} />);

    askQuestion("Can they cancel?");
    const first = await screen.findByText("The Client can end the agreement whenever it wants.");
    const inference = screen.getByText("Work could stop without warning.");
    expect(within(inference).getByText("Inference")).toBeTruthy();
    const toggle = within(first.closest("li")!).getByRole("button", { name: "Show the quote it rests on" });
    fireEvent.click(toggle);
    expect(within(first.closest("li")!).getByText(`“${source.text}”`)).toBeTruthy();

    askQuestion("Can I cancel?");
    const failure = await screen.findByRole("alert");
    expect(failure.textContent).toContain("Redline couldn't answer this");
    const asked = screen.getAllByText(/Can (they|I) cancel\?/).map((node) => node.textContent);
    expect(asked).toEqual(["You asked: Can they cancel?", "You asked: Can I cancel?"]);
    expect(screen.getByText("The Client can end the agreement whenever it wants.")).toBeTruthy();
  });

  it("refuses a blank question and sends nothing", () => {
    const fetchSpy = answering();
    render(<QuestionBox fileName="lease.pdf" text={TEXT} />);

    askQuestion("   ");

    expect(screen.getByRole("alert").textContent).toBe("Type a question first.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
