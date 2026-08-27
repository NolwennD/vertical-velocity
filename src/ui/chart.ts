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
import { type Analysis, analyseClimbs } from "../analysis/vertical-velocity";
import type { I18n } from "../i18n/index";

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

const METERS_PER_KILOMETER = 1000;
const CIRCLED_ONE = 0x2460;

const BAND = "rgba(220, 90, 60, 0.18)";
const BAND_HIGHLIGHTED = "rgba(220, 90, 60, 0.42)";

const numbered = (index: number): string => String.fromCodePoint(CIRCLED_ONE + index);

export function renderChart(
  canvas: HTMLCanvasElement,
  analysis: Analysis,
  i18n: I18n,
  onHoverClimb: (climbIndex: number | null) => void,
): ChartHandle {
  const stats = analyseClimbs(analysis.climbs);

  const annotations = Object.fromEntries(
    analysis.climbs.map((climb, index) => {
      const velocity = stats[index]?.verticalVelocityMoving ?? 0;

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
            content: `${numbered(index)} ${i18n.formatNumber(velocity)} m/h`,
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
        x: { type: "linear", title: { display: true, text: i18n.t("chart-distance") } },
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
      for (const [index, key] of Object.keys(annotations).entries()) {
        const band = chart.options.plugins?.annotation?.annotations;
        const entry = band === undefined ? undefined : Reflect.get(band, key);
        if (entry !== undefined && typeof entry === "object") {
          Reflect.set(entry, "backgroundColor", index === climbIndex ? BAND_HIGHLIGHTED : BAND);
        }
      }
      chart.update("none");
    },
    destroy: () => chart.destroy(),
  };
}
