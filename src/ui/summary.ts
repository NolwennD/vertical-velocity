import type { Climb } from "../analysis/climbs";
import { type ClimbStats, summarise } from "../analysis/vertical-velocity";
import type { Thresholds } from "../constants";
import type { MessageKey } from "../i18n/en";
import type { I18n } from "../i18n/index";
import { METERS_PER_KILOMETER } from "./figures";

const lines = (totals: ClimbStats, i18n: I18n): readonly [MessageKey, string][] => [
  ["table-gain", `${i18n.formatNumber(totals.gainM)} m`],
  ["table-distance", `${i18n.formatNumber(totals.distanceM / METERS_PER_KILOMETER, 1)} km`],
  ["table-moving-time", i18n.formatDuration(totals.moving)],
  ["table-immobile-time", i18n.formatDuration(totals.elapsed.subtract(totals.moving))],
];

export function renderSummary(
  root: HTMLElement,
  climbs: readonly Climb[],
  i18n: I18n,
  t: Thresholds,
): void {
  root.replaceChildren(
    ...lines(summarise(climbs, t), i18n).map(([key, value]) => {
      const term = document.createElement("dt");
      term.textContent = i18n.t(key);

      const figure = document.createElement("dd");
      figure.textContent = value;

      const pair = document.createElement("div");
      pair.append(term, figure);

      return pair;
    }),
  );
}
