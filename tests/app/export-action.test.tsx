// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { analyse } from "../../lib/analysis/analyse";
import { buildMarkedUpCopy } from "../../lib/export/marked-up-copy";
import { ExportAction } from "../../app/(app)/app/ExportAction";
import { loadFixture, SidecarModelClient } from "../support/sidecar-model-client";

const adhesion = loadFixture("adhesion-contract");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("the marked-up copy download", () => {
  it("saves the marked-up copy made in the browser and sends nothing", async () => {
    const result = await analyse(adhesion.text, [], new SidecarModelClient(adhesion));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const blobs: Blob[] = [];
    // The object URL is the browser's download boundary, not the thing under test.
    vi.stubGlobal("URL", Object.assign(Object.create(URL), {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:marked-up-copy";
      },
      revokeObjectURL: () => {},
    }));
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });

    render(<ExportAction fileName="adhesion-contract.txt" text={adhesion.text} result={result} />);
    fireEvent.click(screen.getByRole("button", { name: "Download marked-up copy" }));

    expect(blobs).toHaveLength(1);
    expect(await blobText(blobs[0])).toBe(buildMarkedUpCopy(adhesion.text, result, "adhesion-contract.txt"));
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("adhesion-contract-marked-up.txt");
    expect(clicked[0].getAttribute("href")).toBe("blob:marked-up-copy");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
