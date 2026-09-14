// Runs the adhesion contract fixture through the real pipeline: segmenter, prompt, OpenRouter
// client and `analyse` with citation validation. Calls the real API and costs money.
//
//   npm run smoke
//
// Runs on Node 24's built-in type stripping (no extra dependency). Loads .env.local if present.

import { readFileSync } from "node:fs";
import { analyse, AnalysisResponseError, CitationError } from "../lib/analysis/analyse.ts";
import { ModelError } from "../lib/model/model-client.ts";
import { createOpenRouterClient } from "../lib/model/openrouter-client.ts";

const fixturePath = new URL("../tests/fixtures/adhesion-contract.txt", import.meta.url);
const documentText = readFileSync(fixturePath, "utf8");

if (!process.env.OPENROUTER_API_KEY?.trim() || !process.env.OPENROUTER_MODEL?.trim()) {
  console.error(
    "Smoke test needs OPENROUTER_API_KEY and OPENROUTER_MODEL. Put them in .env.local (see .env.example) and run npm run smoke again.",
  );
  process.exit(1);
}

console.log(`Model: ${process.env.OPENROUTER_MODEL}`);
console.log(`Document: tests/fixtures/adhesion-contract.txt (${documentText.length} characters)\n`);

const started = Date.now();
try {
  const result = await analyse(documentText, [], createOpenRouterClient());
  console.log(`${result.riskFlags.length} Risk flags, every one cited verbatim (${Date.now() - started} ms)\n`);
  for (const flag of result.riskFlags) {
    console.log(`#${flag.rank} [${flag.severityBand}] ${flag.title}`);
    for (const claim of flag.claims) {
      console.log(`   (${claim.tier}) ${claim.text}`);
    }
    console.log(`   Source [${flag.source.start}, ${flag.source.end}): "${flag.source.text}"`);
    console.log(`   Counter-offer: ${flag.counterOffer}\n`);
  }
  console.log(`${result.worthALook.length} Worth a look, not ranked, every one cited verbatim\n`);
  for (const entry of result.worthALook) {
    console.log(`- ${entry.title}`);
    for (const claim of entry.claims) {
      console.log(`   (${claim.tier}) ${claim.text}`);
    }
    console.log(`   Source [${entry.source.start}, ${entry.source.end}): "${entry.source.text}"\n`);
  }
  process.exit(0);
} catch (error) {
  if (error instanceof CitationError) {
    console.error(`Citation validation failed: ${error.passedCount} of ${error.findingCount} findings passed.\n`);
    for (const failure of error.failures) {
      console.error(`- ${failure.findingType} #${failure.index}: ${failure.reason}, unit ${JSON.stringify(failure.unitId)}`);
      console.error(`  quote: ${JSON.stringify(failure.quote)}`);
    }
  } else if (error instanceof ModelError || error instanceof AnalysisResponseError) {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
}
