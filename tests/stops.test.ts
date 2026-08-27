import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { smoothTrack } from "../src/analysis/smooth";
import { type AnalysedTrack, detectStops, timeBreakdown } from "../src/analysis/stops";
import type { Track } from "../src/gpx/parser";
import { mapAtLeastTwo } from "../src/type";
import { atLeastTwo, pointAt } from "./helpers/track";

const NANOSECOND_DIGITS = 9;
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

const stopsOf = (track: Track): readonly boolean[] =>
  detectStops(smoothTrack(track)).map((point) => point.stopped);

const analysed = (track: Track, flags: readonly boolean[]): AnalysedTrack =>
  mapAtLeastTwo(smoothTrack(track), (point, index) => ({
    ...point,
    stopped: flags[index] ?? false,
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

const timeOf = (track: AnalysedTrack, index: number): Temporal.Instant =>
  (track[index] ?? track[0]).time;

describe("a stop is at least ten seconds of immobility within a six meter radius", () => {
  it("marks thirty seconds spent at the same position", () => {
    const track = trackOf(walk(31, { meter: 0, second: 0 }, 0));

    expect(stopsOf(track)).toEqual(repeat(31, true));
  });

  it("marks ten seconds spent at the same position, the shortest stop there is", () => {
    const track = trackOf(walk(11, { meter: 0, second: 0 }, 0));

    expect(stopsOf(track)).toEqual(repeat(11, true));
  });

  it("leaves six seconds at the same position unmarked, too brief to be a stop", () => {
    const track = trackOf(walk(7, { meter: 0, second: 0 }, 0));

    expect(stopsOf(track)).toEqual(repeat(7, false));
  });

  it("marks thirty seconds of drift within a four meter radius, as GPS noise does not cancel a stop", () => {
    const track = trackOf(walk(31, { meter: 0, second: 0 }, DRIFT_METER_PER_SECOND));

    expect(stopsOf(track)).toEqual(repeat(31, true));
  });

  it("leaves thirty seconds of steady progress at four kilometers per hour unmarked", () => {
    const track = trackOf(walk(31, { meter: 0, second: 0 }, WALKING_METER_PER_SECOND));

    expect(stopsOf(track)).toEqual(repeat(31, false));
  });

  it("marks only the stationary points of a ride that pauses thirty seconds mid-way", () => {
    const track = trackOf([
      ...walk(3, { meter: 0, second: 0 }, RIDING_METER_PER_SECOND),
      ...walk(31, { meter: 30, second: 3 }, 0),
      ...walk(3, { meter: 40, second: 34 }, RIDING_METER_PER_SECOND),
    ]);

    expect(stopsOf(track)).toEqual([...repeat(3, false), ...repeat(31, true), ...repeat(3, false)]);
  });
});

describe("an interval longer than sixty seconds is a recording gap, neither movement nor a stop", () => {
  it("counts a ten minute jump between two distant points as gap time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 5000, second: 600 },
    ]);

    const breakdown = timeBreakdown(analysed(track, [false, false]), 0, 1);

    expect(seconds(breakdown.gap)).toBe(600);
    expect(seconds(breakdown.moving)).toBe(0);
    expect(seconds(breakdown.stopped)).toBe(0);
  });

  it("counts a ten minute jump between two points at the same place as gap time, not as stopped time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 0, second: 600 },
    ]);

    const breakdown = timeBreakdown(analysed(track, [true, true]), 0, 1);

    expect(seconds(breakdown.gap)).toBe(600);
    expect(seconds(breakdown.stopped)).toBe(0);
    expect(seconds(breakdown.moving)).toBe(0);
  });

  it("leaves a fifty-nine second interval out of the gap time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 65, second: 59 },
    ]);

    const breakdown = timeBreakdown(analysed(track, [false, false]), 0, 1);

    expect(seconds(breakdown.gap)).toBe(0);
    expect(seconds(breakdown.moving)).toBe(59);
  });

  it("leaves a sixty second interval, exactly at the threshold, out of the gap time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 66, second: 60 },
    ]);

    const breakdown = timeBreakdown(analysed(track, [false, false]), 0, 1);

    expect(seconds(breakdown.gap)).toBe(0);
    expect(seconds(breakdown.moving)).toBe(60);
  });
});

describe("timeBreakdown allocates the whole duration of a segment without losing any of it", () => {
  it("gives the whole duration to movement on a segment without stop or gap", () => {
    const track = trackOf(walk(11, { meter: 0, second: 0 }, WALKING_METER_PER_SECOND));

    const breakdown = timeBreakdown(analysed(track, repeat(11, false)), 0, 10);

    expect(seconds(breakdown.moving)).toBe(10);
    expect(seconds(breakdown.stopped)).toBe(0);
    expect(seconds(breakdown.gap)).toBe(0);
  });

  it("counts the interval between two points both marked as stopped as stopped time", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 0, second: 10 },
      { meter: 0, second: 20 },
    ]);

    const breakdown = timeBreakdown(analysed(track, repeat(3, true)), 0, 2);

    expect(seconds(breakdown.stopped)).toBe(20);
    expect(seconds(breakdown.moving)).toBe(0);
  });

  it("counts the intervals entering and leaving a stop as movement", () => {
    const track = trackOf([
      { meter: 0, second: 0 },
      { meter: 10, second: 10 },
      { meter: 10, second: 20 },
      { meter: 20, second: 30 },
    ]);

    const breakdown = timeBreakdown(analysed(track, [false, true, true, false]), 0, 3);

    expect(seconds(breakdown.moving)).toBe(20);
    expect(seconds(breakdown.stopped)).toBe(10);
  });

  it("splits any segment into movement, stops and gaps that add up to its elapsed time", () => {
    fc.assert(
      fc.property(arbitraryTrack, arbitraryFlags, fc.nat(), fc.nat(), (track, flags, a, b) => {
        const fromIdx = Math.min(a % track.length, b % track.length);
        const toIdx = Math.max(a % track.length, b % track.length);

        const analysedTrack = analysed(track, flags);
        const breakdown = timeBreakdown(analysedTrack, fromIdx, toIdx);
        const elapsed = timeOf(analysedTrack, toIdx).since(timeOf(analysedTrack, fromIdx));

        expect(
          seconds(breakdown.moving) + seconds(breakdown.stopped) + seconds(breakdown.gap),
        ).toBeCloseTo(seconds(elapsed), NANOSECOND_DIGITS);
      }),
    );
  });
});
