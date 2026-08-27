import { describe, expect, it } from "vitest";
import { analyse, analyseClimbs, summarise } from "../src/analysis/vertical-velocity";
import { DEFAULTS, type Thresholds } from "../src/constants";
import { atLeastTwo, pointAt } from "./helpers/track";

const UNSMOOTHED = { ...DEFAULTS, medianWindowPoints: 1, smoothingWindowM: 0 };
const SPARSELY_RECORDED = { ...UNSMOOTHED, recordingGapS: 3600 };

type Step = { meter: number; ele: number; second: number };

const trackOf = (steps: readonly Step[]) => atLeastTwo(steps.map(pointAt));

const climbsOf = (steps: readonly Step[], t: Thresholds = UNSMOOTHED) =>
  analyse(trackOf(steps), t).climbs;

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

const SAWTOOTH = phases([
  { count: 10, step: { meter: 10, ele: 5, second: 10 } },
  { count: 10, step: { meter: 10, ele: -5, second: 10 } },
  { count: 10, step: { meter: 10, ele: 5, second: 10 } },
  { count: 10, step: { meter: 10, ele: -5, second: 10 } },
  { count: 10, step: { meter: 10, ele: 5, second: 10 } },
]);

describe("vertical velocity is the elevation gain divided by the duration, in meters per hour", () => {
  it("reads 1200 m/h on a climb gaining 1200 m in one hour", () => {
    const climbs = climbsOf(phases([{ count: 100, step: { meter: 120, ele: 12, second: 36 } }]));

    expect(analyseClimbs(climbs)).toMatchObject([
      {
        verticalVelocityMoving: 1200,
        verticalVelocityElapsed: 1200,
        averageGrade: expect.closeTo(0.1, 6),
      },
    ]);
  });

  it("gives the two measures the very same value on a climb without a pause", () => {
    const climbs = climbsOf(phases([{ count: 100, step: { meter: 120, ele: 12, second: 36 } }]));
    const [stats] = analyseClimbs(climbs);

    expect(stats).toBeDefined();
    expect(stats?.verticalVelocityMoving).toBe(stats?.verticalVelocityElapsed);
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

    expect(analyseClimbs(climbs, SPARSELY_RECORDED)).toMatchObject([
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

    expect(analyseClimbs(climbs)).toMatchObject([
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

    expect(analyseClimbs(climbs)).toMatchObject([
      {
        verticalVelocityMoving: 0,
        verticalVelocityElapsed: 100,
        averageGrade: expect.closeTo(0.05, 6),
      },
    ]);
  });
});

describe("analyse chains the steps and returns a coherent whole", () => {
  it("keeps one analysed point per point of the track it was given", () => {
    const track = trackOf(SAWTOOTH);

    expect(analyse(track, UNSMOOTHED).track).toHaveLength(track.length);
  });

  it("returns climbs in order, without overlap", () => {
    const { climbs } = analyse(trackOf(SAWTOOTH), UNSMOOTHED);

    expect(climbs.length).toBeGreaterThan(1);
    for (const [index, climb] of climbs.entries()) {
      const previous = climbs[index - 1];
      if (previous !== undefined) {
        expect(climb[0].distanceM).toBeGreaterThanOrEqual(previous.at(-1)?.distanceM ?? 0);
      }
    }
  });
});

describe("the summary recomputes the velocities on the totals, it does not average them", () => {
  const slow = climbsOf(phases([{ count: 180, step: { meter: 11, ele: 100 / 180, second: 60 } }]));
  const fast = climbsOf(phases([{ count: 60, step: { meter: 33, ele: 100 / 60, second: 60 } }]));

  it("adds up the gains and the distances", () => {
    const total = summarise([...fast, ...slow]);

    expect(total.gainM).toBeCloseTo(200, 6);
    expect(total.distanceM).toBeCloseTo(60 * 33 + 180 * 11, 0);
  });

  it("divides the total gain by the total moving time, not the mean of the two rates", () => {
    const total = summarise([...fast, ...slow]);
    const [first, second] = analyseClimbs([...fast, ...slow]);
    const averaged =
      ((first?.verticalVelocityMoving ?? 0) + (second?.verticalVelocityMoving ?? 0)) / 2;

    expect(total.verticalVelocityMoving).toBeCloseTo(50, 6);
    expect(averaged).toBeCloseTo(200 / 3, 1);
    expect(total.verticalVelocityMoving).not.toBeCloseTo(averaged, 1);
  });
});
