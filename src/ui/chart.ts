import {
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import type { Climb } from "../analysis/climbs";
import { type Analysis, analyseClimb } from "../analysis/vertical-velocity";
import type { Thresholds } from "../constants";
import type { I18n } from "../i18n/index";
import { figuresOf, METERS_PER_KILOMETER, numbered } from "./figures";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  annotationPlugin,
);

export type ChartHandle = {
  highlight(climbIndex: number | null): void;
  destroy(): void;
};

const BAND = "rgba(220, 90, 60, 0.18)";
const BAND_HIGHLIGHTED = "rgba(220, 90, 60, 0.42)";

export function renderChart(
  canvas: HTMLCanvasElement,
  analysis: Analysis,
  i18n: I18n,
  t: Thresholds,
  onHoverClimb: (climbIndex: number | null) => void,
): ChartHandle {
  const detail = (climb: Climb, index: number): string[] => [
    numbered(index),
    ...figuresOf(analyseClimb(climb, t), i18n).map(([key, value]) => `${i18n.t(key)} ${value}`),
  ];

  const annotations = Object.fromEntries(
    analysis.climbs.map((climb, index) => {
      return [
        `climb-${index}`,
        {
          type: "box" as const,
          xMin: (climb[0]?.distanceM ?? 0) / METERS_PER_KILOMETER,
          xMax: (climb.at(-1)?.distanceM ?? 0) / METERS_PER_KILOMETER,
          backgroundColor: BAND,
          borderWidth: 0,
          label: {
            display: true,
            content: numbered(index),
            position: { x: "center" as const, y: "start" as const },
          },
          enter: () => onHoverClimb(index),
          leave: () => onHoverClimb(null),
        },
      ];
    }),
  );

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          data: analysis.track.map((point) => ({
            x: point.distanceM / METERS_PER_KILOMETER,
            y: point.smoothedEle,
          })),
          fill: "start",
          borderColor: "rgba(90, 90, 90, 0.9)",
          backgroundColor: "rgba(90, 90, 90, 0.15)",
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      scales: {
        x: {
          type: "linear",
          bounds: "data",
          title: { display: true, text: i18n.t("chart-distance") },
        },
        y: { title: { display: true, text: i18n.t("chart-elevation") } },
      },
      plugins: {
        annotation: { annotations },
        tooltip: { enabled: true },
      },
    },
  });

  return {
    highlight: (climbIndex) => {
      for (const [index, climb] of analysis.climbs.entries()) {
        const band = chart.options.plugins?.annotation?.annotations;
        const entry = band === undefined ? undefined : Reflect.get(band, `climb-${index}`);
        if (entry !== undefined && typeof entry === "object") {
          const chosen = index === climbIndex;
          Reflect.set(entry, "backgroundColor", chosen ? BAND_HIGHLIGHTED : BAND);
          Reflect.set(entry, "label", {
            display: true,
            content: chosen ? detail(climb, index) : numbered(index),
            position: { x: "center", y: "start" },
          });
        }
      }
      chart.update("none");
    },
    destroy: () => chart.destroy(),
  };
}
