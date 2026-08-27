import { analyse } from "./analysis/vertical-velocity";
import { DEFAULTS, type Thresholds } from "./constants";
import type { GpxParser } from "./gpx/parser";
import { GpxError } from "./gpx/parser";
import { parseGpx } from "./gpx/togeojson-adapter";
import type { Lang } from "./i18n/dictionaries";
import { en } from "./i18n/en";
import { createI18n, detectLanguage, type I18n, type MessageKey } from "./i18n/index";
import { type ChartHandle, renderChart } from "./ui/chart";
import { mountDropzone } from "./ui/dropzone";
import { mountImmobilitySelect } from "./ui/immobility-select";
import { mountLanguageSelect } from "./ui/language-select";
import { renderSummary } from "./ui/summary";
import { renderTable } from "./ui/table";

const STORAGE_KEY = "vertical-velocity.lang";

const parse: GpxParser = parseGpx;

const isMessageKey = (value: string | null): value is MessageKey =>
  value !== null && Object.hasOwn(en, value);

const element = (id: string): HTMLElement => {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`the page is missing #${id}`);
  }
  return found;
};

const say = (message: string): void => {
  const banner = element("message");
  banner.textContent = message;
  banner.hidden = false;
};

const report = (i18n: I18n, error: unknown): void => {
  clearChart();
  say(error instanceof GpxError ? i18n.t(error.code) : String(error));
};

const show = (i18n: I18n, xml: string): void => {
  try {
    const analysis = analyse(parse(xml), thresholds);
    const { climbs } = analysis;

    say(climbs.length === 0 ? i18n.t("no-climbs") : i18n.formatCount("climb-count", climbs.length));
    clearChart();

    reveal("profile", true);
    reveal("totals", climbs.length > 0);
    reveal("climbs", climbs.length > 0);

    chart = renderChart(canvas(), analysis, i18n, thresholds, (index: number | null) =>
      chart?.highlight(index),
    );
    renderSummary(element("summary"), climbs, i18n, thresholds);
    renderTable(element("table"), climbs, i18n, thresholds, (index: number | null) =>
      chart?.highlight(index),
    );
  } catch (error) {
    report(i18n, error);
  }
};

let loaded: File | undefined;
let thresholds: Thresholds = DEFAULTS;
let chart: ChartHandle | undefined;

const canvas = (): HTMLCanvasElement => {
  const found = element("chart");
  if (!(found instanceof HTMLCanvasElement)) {
    throw new Error("#chart is not a canvas");
  }
  return found;
};

const reveal = (id: string, shown: boolean): void => {
  element(id).hidden = !shown;
};

const clearChart = (): void => {
  chart?.destroy();
  chart = undefined;
  element("table").replaceChildren();
  element("summary").replaceChildren();

  for (const id of ["profile", "totals", "climbs"]) {
    reveal(id, false);
  }
};

const display = (i18n: I18n, file: File): void => {
  file.text().then(
    (xml) => show(i18n, xml),
    (error: unknown) => report(i18n, error),
  );
};

const render = (lang: Lang): void => {
  const i18n = createI18n(lang);

  element("title").textContent = i18n.t("app-title");

  for (const heading of document.querySelectorAll("[data-title]")) {
    const key = heading.getAttribute("data-title");
    if (isMessageKey(key)) {
      heading.textContent = i18n.t(key);
    }
  }

  document.documentElement.lang = lang;

  mountLanguageSelect(element("language"), i18n, (chosen) => {
    localStorage.setItem(STORAGE_KEY, chosen);
    render(chosen);
  });

  mountImmobilitySelect(
    element("immobility"),
    i18n,
    thresholds.stopRadiusM,
    thresholds.stopMinDurationS,
    (radiusM) => {
      thresholds = { ...thresholds, stopRadiusM: radiusM };
      render(lang);
    },
  );

  mountDropzone(element("dropzone"), i18n, loaded?.name, (file) => {
    loaded = file;
    display(i18n, file);
  });

  if (loaded !== undefined) {
    display(i18n, loaded);
  }
};

render(detectLanguage(navigator.languages, localStorage.getItem(STORAGE_KEY)));
