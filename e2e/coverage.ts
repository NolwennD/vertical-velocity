import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test as base } from "@playwright/test";
import libCoverage, { type CoverageMapData } from "istanbul-lib-coverage";
import { createSourceMapStore } from "istanbul-lib-source-maps";

declare global {
  interface Window {
    __coverage__?: CoverageMapData;
  }
}

const OUTPUT_DIRECTORY = ".nyc_output";

// Le navigateur mesure le TypeScript transformé, vitest mesure les sources :
// sans ce remappage la fusion porte sur deux relevés qui ne se recouvrent pas.
const remapped = async (collected: CoverageMapData): Promise<CoverageMapData> => {
  const store = createSourceMapStore();
  const map = await store.transformCoverage(libCoverage.createCoverageMap(collected));

  return map.toJSON();
};

export const test = base.extend<{ coverage: undefined }>({
  coverage: [
    async ({ page }, use) => {
      await use(undefined);

      if (!process.env.VITE_COVERAGE) return;

      const collected = await page.evaluate(() => window.__coverage__);
      if (!collected) return;

      mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      writeFileSync(
        `${OUTPUT_DIRECTORY}/e2e-${randomUUID()}.json`,
        JSON.stringify(await remapped(collected)),
      );
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
