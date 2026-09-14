import type { PdfjsModule } from "./pdf.ts";

let browserWorker: Worker | undefined;

/**
 * Loads pdfjs where the file is being read. In a browser it loads the standard build and runs
 * parsing in a module worker that the bundler emits from `pdfjs-dist` (the `new Worker(new URL(...,
 * import.meta.url))` form is what Next's bundler recognises). Without a `Worker` global (Node, and
 * the test environments) it loads the legacy build, which parses on the calling thread.
 */
export async function loadPdfjs(): Promise<PdfjsModule> {
  if (typeof window !== "undefined" && typeof Worker === "function") {
    const pdfjs = await import("pdfjs-dist");
    browserWorker ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    });
    pdfjs.GlobalWorkerOptions.workerPort = browserWorker;
    return pdfjs;
  }
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}
