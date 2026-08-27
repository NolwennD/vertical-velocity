import { describe, expect, it } from "vitest";
import { detectClimbs } from "../src/analysis/climbs";
import { detectImmobility } from "../src/analysis/immobility";
import { smoothTrack } from "../src/analysis/smooth";
import { analyseClimbs } from "../src/analysis/vertical-velocity";
import { DEFAULTS, type Thresholds } from "../src/constants";
import { atLeastTwo, pointAt } from "./helpers/track";

const UNSMOOTHED = { ...DEFAULTS, medianWindowPoints: 1, smoothingWindowM: 0 };
const SPARSELY_RECORDED = { ...UNSMOOTHED, recordingGapS: 3600 };

type Step = { meter: number; ele: number; second: number };

const climbsOf = (steps: readonly Step[], t: Thresholds = UNSMOOTHED) =>
  detectClimbs(detectImmobility(smoothTrack(atLeastTwo(steps.map(pointAt)), t), t), t);

const phases = (legs: readonly { count: number; step: Step }[]): Step[] => {
  let last: Step = { meter: 0, ele: 1000, second: 0 };
  const steps: Step[] = [last];

  for (const { count, step } of legs) {
    for (let index = 0; index < count; index += 1) {
      last = {
        meter: last.meter + step.meter,
        ele: last.ele + step.ele,
        second: last.second + step.second,
      };
      steps.push(last);
    }
  }

  return steps;
};

describe("vertical velocity is the elevation gain divided by the duration, in meters per hour", () => {
  it("reads 1200 m/h on a climb gaining 1200 m in one hour", () => {
    const climbs = climbsOf(phases([{ count: 100, step: { meter: 120, ele: 12, second: 36 } }]));

    expect(analyseClimbs(climbs)).toEqual([
      {
        verticalVelocityMoving: 1200,
        verticalVelocityElapsed: 1200,
        averageGrade: expect.closeTo(0.1, 6),
      },
    ]);
  });

  it("reads the same 1200 m/h when the same gain and hour hold a flat in the middle", () => {
    const climbs = climbsOf(
      [
        { meter: 0, ele: 1000, second: 0 },
        { meter: 5950, ele: 1600, second: 1795 },
        { meter: 6050, ele: 1600, second: 1805 },
        { meter: 12000, ele: 2200, second: 3600 },
      ],
      SPARSELY_RECORDED,
    );

    expect(analyseClimbs(climbs, SPARSELY_RECORDED)).toEqual([
      {
        verticalVelocityMoving: 1200,
        verticalVelocityElapsed: 1200,
        averageGrade: expect.closeTo(0.1, 6),
      },
    ]);
  });

  it("reads 900 m/h moving and 600 m/h elapsed on 300 m climbed in thirty minutes with ten stopped", () => {
    const climbs = climbsOf(
      phases([
        { count: 60, step: { meter: 20, ele: 2.5, second: 10 } },
        { count: 60, step: { meter: 0, ele: 0, second: 10 } },
        { count: 60, step: { meter: 20, ele: 2.5, second: 10 } },
      ]),
    );

    expect(analyseClimbs(climbs)).toEqual([
      {
        verticalVelocityMoving: 900,
        verticalVelocityElapsed: 600,
        averageGrade: expect.closeTo(0.125, 6),
      },
    ]);
  });

  it("reads zero rather than infinity when a recording gap swallows the whole climb", () => {
    const climbs = climbsOf([
      { meter: 0, ele: 1000, second: 0 },
      { meter: 2000, ele: 1100, second: 3600 },
    ]);

    expect(analyseClimbs(climbs)).toEqual([
      {
        verticalVelocityMoving: 0,
        verticalVelocityElapsed: 100,
        averageGrade: expect.closeTo(0.05, 6),
      },
    ]);
  });
});
