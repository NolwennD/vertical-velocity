import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type AnalysedTrack, detectImmobility, movingTime } from "../src/analysis/immobility";
import { smoothTrack } from "../src/analysis/smooth";
import type { Track } from "../src/gpx/parser";
import { mapAtLeastTwo } from "../src/type";
import { atLeastTwo, pointAt } from "./helpers/track";

const WALKING_METER_PER_SECOND = 4000 / 3600;
const RIDING_METER_PER_SECOND = 10;
const DRIFT_METER_PER_SECOND = 4 / 30;
const MAX_EXTRA_STEPS = 30;
const FLAG_COUNT = 2 + MAX_EXTRA_STEPS;

type Sample = { meter: number; second: number };

const trackOf = (samples: readonly Sample[]): Track =>
  atLeastTwo(samples.map(({ meter, second }) => pointAt({ meter, ele: 1000, second })));

const walk = (count: number, from: Sample, meterPerSecond: number): Sample[] =>
  Array.from({ length: count }, (_, index) => ({
    meter: from.meter + index * meterPerSecond,
    second: from.second + index,
  }));

const repeat = (count: number, flag: boolean): boolean[] => Array<boolean>(count).fill(flag);

const immobilityOf = (track: Track): readonly boolean[] =>
  detectImmobility(smoothTrack(track)).map((point) => point.immobile);

const flagged = (track: Track, flags: readonly boolean[]): AnalysedTrack =>
  mapAtLeastTwo(smoothTrack(track), (point, index) => ({
    ...point,
    immobile: flags[index] ?? false,
  }));

const seconds = (duration: Temporal.Duration): number => duration.total("seconds");

const cumulated = (steps: readonly Sample[]): Sample[] => {
  const samples: Sample[] = [];
  let meter = 0;
  let second = 0;

  for (const step of steps) {
    meter += step.meter;
    second += step.second;
    samples.push({ meter, second });
  }

  return samples;
};

const arbitraryStep = fc.record({
  meter: fc.double({ min: 0, max: 1000, noNaN: true }),
  second: fc.integer({ min: 0, max: 600 }),
});

const arbitraryTrack = fc
  .tuple(arbitraryStep, arbitraryStep, fc.array(arbitraryStep, { maxLength: MAX_EXTRA_STEPS }))
  .map(([first, second, rest]) => trackOf(cumulated([first, second, ...rest])));

const arbitraryFlags = fc.array(fc.boolean(), { minLength: FLAG_COUNT, maxLength: FLAG_COUNT });

describe("a point is immobile when it stays within six meters for at least twenty seconds", () => {
  it("marks thirty seconds spent at the same position", () => {
    expect(immobilityOf(trackOf(walk(31, { meter: 0, second: 0 }, 0)))).toEqual(repeat(31, true));
  });

  it("marks twenty seconds spent at the same position, the shortest immobility there is", () => {
    expect(immobilityOf(trackOf(walk(21, { meter: 0, second: 0 }, 0)))).toEqual(repeat(21, true));
  });

  it("leaves nineteen seconds at the same position unmarked, just short of the threshold", () => {
    expect(immobilityOf(trackOf(walk(20, { meter: 0, second: 0 }, 0)))).toEqual(repeat(20, false));
  });

  it("marks thirty seconds of drift within a four meter radius, as GPS noise does not cancel it", () => {
    expect(
      immobilityOf(trackOf(walk(31, { meter: 0, second: 0 }, DRIFT_METER_PER_SECOND))),
    ).toEqual(repeat(31, true));
  });

  it("leaves thirty seconds of steady progress at four kilometers per hour unmarked", () => {
    expect(
      immobilityOf(trackOf(walk(31, { meter: 0, second: 0 }, WALKING_METER_PER_SECOND))),
    ).toEqual(repeat(31, false));
  });

  it("marks only the stationary points of a ride that pauses thirty seconds mid-way", () => {
    const track = trackOf([
      ...walk(3, { meter: 0, second: 0 }, RIDING_METER_PER_SECOND),
      ...walk(31, { meter: 30, second: 3 }, 0),
      ...walk(3, { meter: 40, second: 34 }, RIDING_METER_PER_SECOND),
    ]);

    expect(immobilityOf(track)).toEqual([
      ...repeat(3, false),
      ...repeat(31, true),
      ...repeat(3, false),
    ]);
  });
});

describe("an interval longer than sixty seconds is never counted as movement", () => {
  it("leaves a ten minute jump between two distant points out of the moving time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 5000, second: 600 },
    ]);

    expect(seconds(movingTime(flagged(track, [false, false])))).toBe(0);
  });

  it("leaves a ten minute jump out whether it reads as immobility or as an unrecorded interval", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 0, second: 600 },
    ]);

    expect(seconds(movingTime(flagged(track, [true, true])))).toBe(0);
    expect(seconds(movingTime(flagged(track, [false, false])))).toBe(0);
  });

  it("keeps a fifty-nine second interval in the moving time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 65, second: 59 },
    ]);

    expect(seconds(movingTime(flagged(track, [false, false])))).toBe(59);
  });

  it("keeps a sixty second interval, exactly at the threshold, in the moving time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 66, second: 60 },
    ]);

    expect(seconds(movingTime(flagged(track, [false, false])))).toBe(60);
  });
});

describe("moving time counts only the intervals where the track actually progresses", () => {
  it("gives the whole duration to movement on a track that never stalls", () => {
    const track = trackOf(walk(11, { meter: 0, second: 0 }, WALKING_METER_PER_SECOND));

    expect(seconds(movingTime(flagged(track, repeat(11, false))))).toBe(10);
  });

  it("drops the interval between two points both marked immobile", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 0, second: 10 },
      { meter: 0, second: 20 },
    ]);

    expect(seconds(movingTime(flagged(track, repeat(3, true))))).toBe(0);
  });

  it("keeps the intervals entering and leaving an immobile stretch", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 10, second: 10 },
      { meter: 10, second: 20 },
      { meter: 20, second: 30 },
    ]);

    expect(seconds(movingTime(flagged(track, [false, true, true, false])))).toBe(20);
  });

  it("never claims more moving time than the track has elapsed", () => {
    fc.assert(
      fc.property(arbitraryTrack, arbitraryFlags, (track, flags) => {
        const analysed = flagged(track, flags);
        const elapsed = analysed[analysed.length - 1] ?? analysed[0];

        expect(seconds(movingTime(analysed))).toBeLessThanOrEqual(
          seconds(elapsed.time.since(analysed[0].time)),
        );
      }),
    );
  });
});
