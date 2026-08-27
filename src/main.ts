import { analyse } from "./analysis/vertical-velocity";
import type { GpxParser } from "./gpx/parser";
import { GpxError } from "./gpx/parser";
import { parseGpx } from "./gpx/togeojson-adapter";
import type { Lang } from "./i18n/dictionaries";
import { createI18n, detectLanguage, type I18n } from "./i18n/index";
import { type ChartHandle, renderChart } from "./ui/chart";
import { mountDropzone } from "./ui/dropzone";
import { mountLanguageSelect } from "./ui/language-select";
import { renderTable } from "./ui/table";

const STORAGE_KEY = "vertical-velocity.lang";

const parse: GpxParser = parseGpx;

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
    const analysis = analyse(parse(xml));
    const { climbs } = analysis;

    say(climbs.length === 0 ? i18n.t("no-climbs") : i18n.formatCount("climb-count", climbs.length));
    clearChart();
    chart = renderChart(canvas(), analysis, i18n, (index) => chart?.highlight(index));
    renderTable(element("table"), climbs, i18n, (index) => chart?.highlight(index));
  } catch (error) {
    report(i18n, error);
  }
};

let loaded: File | undefined;
let chart: ChartHandle | undefined;

const canvas = (): HTMLCanvasElement => {
  const found = element("chart");
  if (!(found instanceof HTMLCanvasElement)) {
    throw new Error("#chart is not a canvas");
  }
  return found;
};

const clearChart = (): void => {
  chart?.destroy();
  chart = undefined;
  element("table").replaceChildren();
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
  document.documentElement.lang = lang;

  mountLanguageSelect(element("language"), i18n, (chosen) => {
    localStorage.setItem(STORAGE_KEY, chosen);
    render(chosen);
  });

  mountDropzone(element("dropzone"), i18n, loaded?.name, (file) => {
    loaded = file;
    display(i18n, file);
  });

  if (loaded !== undefined) {
    display(i18n, loaded);
  }
};

render(detectLanguage(navigator.languages, localStorage.getItem(STORAGE_KEY)));
