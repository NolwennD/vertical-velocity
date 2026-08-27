import type { Climb } from "../analysis/climbs";
import { analyseClimb } from "../analysis/vertical-velocity";
import type { Thresholds } from "../constants";
import type { MessageKey } from "../i18n/en";
import type { I18n } from "../i18n/index";
import { figuresOf, numbered } from "./figures";

const HEADERS: readonly MessageKey[] = [
  "table-number",
  "table-start-elevation",
  "table-end-elevation",
  "table-gain",
  "table-distance",
  "table-average-grade",
  "table-moving-time",
  "table-elapsed-time",
  "table-vertical-velocity-moving",
  "table-vertical-velocity-elapsed",
];

const row = (cells: readonly string[], tag: "td" | "th"): HTMLTableRowElement => {
  const line = document.createElement("tr");

  for (const [index, cell] of cells.entries()) {
    const box = document.createElement(index === 0 ? "th" : tag);
    box.textContent = cell;
    line.append(box);
  }

  return line;
};

export function renderTable(
  root: HTMLElement,
  climbs: readonly Climb[],
  i18n: I18n,
  t: Thresholds,
  onHoverClimb: (climbIndex: number | null) => void,
): void {
  const head = document.createElement("thead");
  head.append(
    row(
      HEADERS.map((key) => i18n.t(key)),
      "th",
    ),
  );

  const body = document.createElement("tbody");
  for (const [index, climb] of climbs.entries()) {
    const line = row(
      [
        numbered(index),
        `${i18n.formatNumber(climb[0].smoothedEle)} m`,
        `${i18n.formatNumber(climb.at(-1)?.smoothedEle ?? 0)} m`,
        ...figuresOf(analyseClimb(climb, t), i18n).map(([, value]) => value),
      ],
      "td",
    );

    line.addEventListener("mouseenter", () => onHoverClimb(index));
    line.addEventListener("mouseleave", () => onHoverClimb(null));
    body.append(line);
  }

  const table = document.createElement("table");
  table.append(head, body);
  root.replaceChildren(table);
}
