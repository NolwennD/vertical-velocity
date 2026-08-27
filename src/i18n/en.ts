export const en = {
  "app-title": "Vertical Velocity",
  "drop-zone": "Drop a GPX file here, or click to choose one",
  language: "Language",
  "chart-distance": "Distance (km)",
  "chart-elevation": "Elevation (m)",
  "table-number": "#",
  "table-start-elevation": "From",
  "table-end-elevation": "To",
  "table-gain": "Gain",
  "table-distance": "Distance",
  "table-average-grade": "Average grade",
  "table-moving-time": "Moving time",
  "table-elapsed-time": "Elapsed time",
  "table-vertical-velocity-moving": "Vertical velocity, moving",
  "table-vertical-velocity-elapsed": "Vertical velocity, elapsed",
  "table-total": "Total",
  "invalid-xml": "This file is not a valid GPX.",
  "no-track-points": "This file holds no usable track point.",
  "no-elevation": "This track carries no elevation.",
  "no-time": "This track carries no timestamp, so no velocity can be computed.",
  "no-climbs": "No climb of at least 20 m was found.",
  "climb-count-one": "{count} climb",
  "climb-count-other": "{count} climbs",
};

export type MessageKey = keyof typeof en;

type BaseOf<Key> = Key extends `${infer Base}-other` ? Base : never;

export type CountKey = BaseOf<MessageKey>;
