import { describe, expect, it } from "vitest";
import type { ClimbStats } from "../src/analysis/vertical-velocity";
import { createI18n } from "../src/i18n/index";
import { figuresOf } from "../src/ui/figures";

const STATS: ClimbStats = {
  gainM: 92,
  distanceM: 2500,
  moving: Temporal.Duration.from({ seconds: 660 }),
  elapsed: Temporal.Duration.from({ seconds: 900 }),
  averageGrade: 0.0368,
  verticalVelocityMoving: 514,
  verticalVelocityElapsed: 358,
};

describe("a climb is described by the same figures wherever it is shown", () => {
  it("lists the seven figures of the table, in order", () => {
    expect(figuresOf(STATS, createI18n("en")).map(([key]) => key)).toEqual([
      "table-gain",
      "table-distance",
      "table-average-grade",
      "table-moving-time",
      "table-elapsed-time",
      "table-vertical-velocity-moving",
      "table-vertical-velocity-elapsed",
    ]);
  });

  it("writes the distance in kilometers and the gain in meters", () => {
    const values = Object.fromEntries(figuresOf(STATS, createI18n("en")));

    expect(values["table-gain"]).toBe("92 m");
    expect(values["table-distance"]).toBe("2.5 km");
    expect(values["table-vertical-velocity-moving"]).toBe("514 m/h");
  });

  it("follows the active language", () => {
    const values = Object.fromEntries(figuresOf(STATS, createI18n("fr")));

    expect(values["table-distance"]).toBe("2,5 km");
    expect(values["table-average-grade"]).toBe(createI18n("fr").formatPercent(0.0368));
  });
});
