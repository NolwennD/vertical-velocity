import type { ClimbStats } from "../analysis/vertical-velocity";
import type { MessageKey } from "../i18n/en";
import type { I18n } from "../i18n/index";

const METERS_PER_KILOMETER = 1000;

export const figuresOf = (stats: ClimbStats, i18n: I18n): readonly [MessageKey, string][] => [
  ["table-gain", `${i18n.formatNumber(stats.gainM)} m`],
  ["table-distance", `${i18n.formatNumber(stats.distanceM / METERS_PER_KILOMETER, 1)} km`],
  ["table-average-grade", i18n.formatPercent(stats.averageGrade)],
  ["table-moving-time", i18n.formatDuration(stats.moving)],
  ["table-elapsed-time", i18n.formatDuration(stats.elapsed)],
  ["table-vertical-velocity-moving", `${i18n.formatNumber(stats.verticalVelocityMoving)} m/h`],
  ["table-vertical-velocity-elapsed", `${i18n.formatNumber(stats.verticalVelocityElapsed)} m/h`],
];
