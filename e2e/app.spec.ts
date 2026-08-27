import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const REAL_GPX = "tests/fixtures/real-file-anonymised.gpx";

const gpx = (points: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1"><trk><trkseg>${points}</trkseg></trk></gpx>`;

const WITHOUT_ELEVATION = gpx(
  `<trkpt lat="45" lon="6"><time>2024-01-01T10:00:00Z</time></trkpt>
   <trkpt lat="45.01" lon="6"><time>2024-01-01T10:00:30Z</time></trkpt>`,
);

const pick = (page: Page, name: string, body: string | Buffer) =>
  page.locator("#dropzone input[type=file]").setInputFiles({
    name,
    mimeType: "application/gpx+xml",
    buffer: Buffer.isBuffer(body) ? body : Buffer.from(body),
  });

const drop = async (page: Page, name: string, body: string) => {
  const transfer = await page.evaluateHandle(
    ([fileName, content]) => {
      const data = new DataTransfer();
      data.items.add(new File([content ?? ""], fileName ?? "", { type: "application/gpx+xml" }));
      return data;
    },
    [name, body],
  );

  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: transfer });
};

const message = (page: Page) => page.locator("#message");
const zone = (page: Page) => page.locator(".dropzone");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("names the file and counts the climbs of the reference recording", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));

  await expect(zone(page)).toHaveText("real-file-anonymised.gpx");
  await expect(message(page)).toContainText("3");
});

test("states the failure instead of an analysis when the track carries no elevation", async ({
  page,
}) => {
  await pick(page, "flat.gpx", WITHOUT_ELEVATION);

  await expect(message(page)).toHaveText("This track carries no elevation.");
});

test("reads a dropped file the same way as a picked one", async ({ page }) => {
  await drop(page, "flat.gpx", WITHOUT_ELEVATION);

  await expect(zone(page)).toHaveText("flat.gpx");
  await expect(message(page)).toHaveText("This track carries no elevation.");
});

test("translates the interface when the language changes", async ({ page }) => {
  await expect(page.locator("#title")).toHaveText("Vertical Velocity");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#title")).toHaveText("Vitesse ascensionnelle");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("keeps the loaded file and its verdict across a language change", async ({ page }) => {
  await pick(page, "flat.gpx", WITHOUT_ELEVATION);
  await expect(message(page)).toHaveText("This track carries no elevation.");

  await page.locator("#language select").selectOption("fr");

  await expect(zone(page)).toHaveText("flat.gpx");
  await expect(message(page)).toHaveText("Cette trace ne porte aucune altitude.");
});

test("remembers the chosen language across a reload", async ({ page }) => {
  await page.locator("#language select").selectOption("fr");
  await page.reload();

  await expect(page.locator("#title")).toHaveText("Vitesse ascensionnelle");
});
