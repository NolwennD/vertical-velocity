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

const WITHOUT_CLIMB = gpx(
  `<trkpt lat="45" lon="6"><ele>1000</ele><time>2024-01-01T10:00:00Z</time></trkpt>
   <trkpt lat="45.001" lon="6"><ele>1001</ele><time>2024-01-01T10:00:30Z</time></trkpt>`,
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

const paintedPixels = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    for (let index = 3; index < data.length; index += 4) {
      if ((data[index] ?? 0) > 0) {
        painted += 1;
      }
    }
    return painted;
  });
const zone = (page: Page) => page.locator(".dropzone");

const bandSpans = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) {
      return 0;
    }
    const row = Math.floor(canvas.height * 0.3);
    const { data } = context.getImageData(0, row, canvas.width, 1);
    let spans = 0;
    let inside = false;
    for (let column = 0; column < canvas.width; column += 1) {
      const offset = column * 4;
      const reddish = (data[offset] ?? 0) - (data[offset + 2] ?? 0) > 12;
      if (reddish && !inside) {
        spans += 1;
      }
      inside = reddish;
    }
    return spans;
  });

const bandStrength = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) {
      return 0;
    }
    const row = Math.floor(canvas.height * 0.3);
    const { data } = context.getImageData(0, row, canvas.width, 1);
    let strongest = 0;
    for (let column = 0; column < canvas.width; column += 1) {
      const offset = column * 4;
      strongest = Math.max(strongest, (data[offset] ?? 0) - (data[offset + 2] ?? 0));
    }
    return strongest;
  });

const labelInk = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (canvas === null || context === null || context === undefined) {
      return 0;
    }
    const height = Math.floor(canvas.height * 0.25);
    const { data } = context.getImageData(0, 0, canvas.width, height);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) {
      if ((data[index] ?? 255) < 120 && (data[index + 3] ?? 0) > 0) {
        dark += 1;
      }
    }
    return dark;
  });

const canvasWidth = (page: Page) =>
  page.evaluate(() => document.querySelector("canvas")?.width ?? 0);

const canvasHeight = (page: Page) =>
  page.evaluate(() => document.querySelector("canvas")?.getBoundingClientRect().height ?? 0);

const canvasFingerprint = (page: Page) =>
  page.evaluate(() => document.querySelector("canvas")?.toDataURL() ?? "");

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

test("counts the climbs in the active language, plural included", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(message(page)).toHaveText("3 climbs");

  await page.locator("#language select").selectOption("fr");

  await expect(message(page)).toHaveText("3 montées");
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

test("draws the elevation profile once a track is loaded", async ({ page }) => {
  expect(await paintedPixels(page)).toBe(0);

  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(message(page)).toContainText("3");

  expect(await canvasWidth(page)).toBeGreaterThan(0);
  expect(await paintedPixels(page)).toBeGreaterThan(1000);
});

test("leaves the canvas blank when the track cannot be analysed", async ({ page }) => {
  await pick(page, "flat.gpx", WITHOUT_ELEVATION);
  await expect(message(page)).toHaveText("This track carries no elevation.");

  expect(await paintedPixels(page)).toBe(0);
});

test("marks each detected climb with its own band", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(message(page)).toContainText("3");

  expect(await bandSpans(page)).toBe(3);
});

test("repaints the chart when the language changes", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(message(page)).toContainText("3");
  const inEnglish = await canvasFingerprint(page);

  await page.locator("#language select").selectOption("fr");
  await expect(page.locator("#title")).toHaveText("Vitesse ascensionnelle");

  expect(await canvasFingerprint(page)).not.toBe(inEnglish);
});

test("holds the chart to a bounded height instead of growing without end", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(message(page)).toContainText("3");

  const settled = await canvasHeight(page);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(600);

  expect(await canvasHeight(page)).toBe(settled);
  expect(settled).toBeLessThanOrEqual(page.viewportSize()?.height ?? 720);
});

test("lists one row per detected climb, and nothing more", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));

  await expect(page.locator("#table tbody tr")).toHaveCount(3);
  await expect(page.locator("#table tfoot")).toHaveCount(0);
});

test("gathers the cumulative figures in a summary of its own", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));

  await expect(page.locator("#summary dt")).toHaveCount(4);
  await expect(page.locator("#summary dd")).toHaveCount(4);
  await expect(page.locator("#summary")).toContainText("Gain");
  await expect(page.locator("#summary")).toContainText("Immobile");
});

test("labels the summary in the active language", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#summary")).toContainText("Gain");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#summary")).toContainText("Dénivelé");
  await expect(page.locator("#summary")).toContainText("Immobilité");
});

test("clears the summary when the track cannot be analysed", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#summary dt")).toHaveCount(4);

  await pick(page, "flat.gpx", WITHOUT_ELEVATION);

  await expect(page.locator("#summary dt")).toHaveCount(0);
});

test("heads the table in the active language", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#table thead")).toContainText("Gain");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#table thead")).toContainText("Dénivelé");
});

test("shows no table when the track cannot be analysed", async ({ page }) => {
  await pick(page, "flat.gpx", WITHOUT_ELEVATION);

  await expect(page.locator("#table table")).toHaveCount(0);
});

test("deepens the matching band while a table row is hovered", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#table tbody tr")).toHaveCount(3);
  const resting = await bandStrength(page);

  await page.locator("#table tbody tr").first().hover();
  await page.waitForTimeout(200);

  expect(await bandStrength(page)).toBeGreaterThan(resting);
});

test("heads each result section so screen readers can name it", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));

  await expect(page.locator("main section:visible")).toHaveCount(3);
  await expect(page.locator("main section:visible h2")).toHaveCount(3);
});

test("keeps the profile but drops the climb sections when no climb is found", async ({ page }) => {
  await pick(page, "tiny.gpx", WITHOUT_CLIMB);
  await expect(message(page)).toHaveText("No climb of at least 20 m was found.");

  await expect(page.locator("#profile")).toBeVisible();
  await expect(page.locator("#totals")).toBeHidden();
  await expect(page.locator("#climbs")).toBeHidden();
});

test("drops every result section when the track cannot be analysed", async ({ page }) => {
  await pick(page, "flat.gpx", WITHOUT_ELEVATION);

  await expect(page.locator("main section:visible")).toHaveCount(0);
});

test("heads the sections in the active language", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#climbs h2")).toHaveText("Climbs");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#climbs h2")).toHaveText("Montées");
});

test("keeps every total joined to the label it belongs to", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));

  const pairs = page.locator("#summary > div");
  await expect(pairs).toHaveCount(4);

  for (const pair of await pairs.all()) {
    await expect(pair.locator("dt")).toHaveCount(1);
    await expect(pair.locator("dd")).toHaveCount(1);
  }
});

test("opens the climb's figures on its band while the row is hovered", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#table tbody tr")).toHaveCount(3);
  const resting = await labelInk(page);

  await page.locator("#table tbody tr").first().hover();
  await page.waitForTimeout(300);

  expect(await labelInk(page)).toBeGreaterThan(resting);
});

const velocityCell = (page: Page) => page.locator("#table tbody tr").last().locator("td").nth(7);

test("re-reads the ride when the immobility radius changes", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await expect(page.locator("#table tbody tr")).toHaveCount(3);
  const strict = await velocityCell(page).textContent();

  await page.locator("#immobility select").selectOption("12");

  await expect(velocityCell(page)).not.toHaveText(strict ?? "");
});

test("labels the immobility control in the active language", async ({ page }) => {
  await expect(page.locator("#immobility")).toContainText("Immobility");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#immobility")).toContainText("Immobilité");
});

test("keeps the chosen radius across a language change", async ({ page }) => {
  await pick(page, "real-file-anonymised.gpx", readFileSync(REAL_GPX));
  await page.locator("#immobility select").selectOption("12");

  await page.locator("#language select").selectOption("fr");

  await expect(page.locator("#immobility select")).toHaveValue("12");
});
