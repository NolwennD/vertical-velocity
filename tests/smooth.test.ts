import { describe, expect, it } from "vitest";
import { smoothElevations } from "../src/analysis/smooth";
import type { Track, TrackPoint } from "../src/gpx/parser";

const point = (ele: number): TrackPoint => ({
  lat: 45,
  lon: 6,
  ele,
  time: Temporal.Instant.fromEpochMilliseconds(0),
});

const trackOf = (elevations: readonly number[]): Track => {
  const [first, second, ...rest] = elevations.map(point);
  if (first === undefined || second === undefined) {
    throw new Error("a track needs at least two elevations");
  }
  return [first, second, ...rest];
};

const at = (values: readonly number[], index: number): number => values[index] ?? Number.NaN;

const ramp = (count: number, spacingMeter: number, grade: number): number[] =>
  Array.from({ length: count }, (_, index) => 1000 + index * spacingMeter * grade);

const smooth = (elevations: readonly number[], spacingMeter: number) =>
  smoothElevations(
    trackOf(elevations),
    Array.from({ length: elevations.length }, (_, index) => index * spacingMeter),
  );

const withSpike = (elevations: readonly number[], index: number, offset: number): number[] =>
  elevations.map((ele, current) => (current === index ? ele + offset : ele));

describe("the median filter removes isolated outlier elevations", () => {
  const clean = ramp(21, 10, 0.05);

  it("erases a single point offset by 40 m on a steady ramp", () => {
    const spiked = withSpike(clean, 10, 40);

    const smoothed = smooth(spiked, 10);

    expect(at(smoothed, 10)).toBeCloseTo(at(clean, 10), 0);
  });

  it("still corrects two consecutive outliers inside a window of five", () => {
    const spiked = withSpike(withSpike(clean, 10, 40), 11, 40);

    const smoothed = smooth(spiked, 10);

    expect(Math.abs(at(smoothed, 10) - at(clean, 10))).toBeLessThan(2);
    expect(Math.abs(at(smoothed, 11) - at(clean, 11))).toBeLessThan(2);
  });

  it("no longer corrects three consecutive outliers, as a median over five cannot", () => {
    const spiked = withSpike(withSpike(withSpike(clean, 10, 40), 11, 40), 12, 40);

    const smoothed = smooth(spiked, 10);

    expect(at(smoothed, 11)).toBeGreaterThan(at(clean, 11) + 20);
  });
});

describe("the moving average works on a window expressed in meters, not in points", () => {
  it("gives comparable elevations for the same slope sampled every 1 m and every 5 m", () => {
    const dense = smooth(ramp(101, 1, 0.08), 1);
    const sparse = smooth(ramp(21, 5, 0.08), 5);

    for (const [index, elevation] of sparse.entries()) {
      expect(elevation).toBeCloseTo(at(dense, index * 5), 0);
    }
  });

  it("leaves a steady ramp unchanged within 0.5 m", () => {
    const elevations = ramp(41, 5, 0.06);

    const smoothed = smooth(elevations, 5);

    for (const [index, expected] of elevations.entries()) {
      expect(Math.abs(at(smoothed, index) - expected)).toBeLessThan(0.5);
    }
  });

  it("preserves a real grade break between a flat and an 8% slope", () => {
    const flat = Array.from({ length: 30 }, () => 1000);
    const climb = Array.from({ length: 30 }, (_, index) => 1000 + (index + 1) * 5 * 0.08);
    const elevations = [...flat, ...climb];

    const smoothed = smooth(elevations, 5);

    expect(at(smoothed, 5)).toBeCloseTo(1000, 1);
    expect(at(smoothed, 55)).toBeCloseTo(at(elevations, 55), 0);
  });
});

describe("the output always has the length of the input", () => {
  it("returns one elevation per point of the track", () => {
    expect(smooth(ramp(37, 4, 0.03), 4)).toHaveLength(37);
  });

  it("returns the two elevations of the shortest possible track", () => {
    expect(smooth([1000, 1002], 10)).toHaveLength(2);
  });
});
