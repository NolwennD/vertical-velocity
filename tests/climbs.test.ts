import { describe, expect, it } from "vitest";
import { detectClimbs } from "../src/analysis/climbs";
import { type SmoothedTrack, smoothTrack } from "../src/analysis/smooth";
import { DEFAULTS } from "../src/constants";
import type { Track } from "../src/gpx/parser";
import { atLeastTwo, pointAt } from "./helpers/track";

const UNSMOOTHED = { ...DEFAULTS, medianWindowPoints: 1, smoothingWindowM: 0 };

const trackOf = (elevations: readonly number[], spacingMeter: number): Track =>
  atLeastTwo(
    elevations.map((ele, index) => pointAt({ meter: index * spacingMeter, ele, second: index })),
  );

const profileOf = (elevations: readonly number[], spacingMeter: number): SmoothedTrack =>
  smoothTrack(trackOf(elevations, spacingMeter), UNSMOOTHED);

const leg = (from: number, count: number, deltaPerPoint: number): number[] =>
  Array.from({ length: count }, (_, index) => from + (index + 1) * deltaPerPoint);

const SAWTOOTH = [
  1000,
  ...leg(1000, 10, 5),
  ...leg(1050, 10, -5),
  ...leg(1000, 10, 5),
  ...leg(1050, 10, -5),
  ...leg(1000, 10, 5),
];

describe("sequences of points whose elevation increases form the candidate segments", () => {
  it("finds three segments in a sawtooth profile with three clear climbs", () => {
    expect(detectClimbs(profileOf(SAWTOOTH, 10))).toHaveLength(3);
  });

  it("finds no segment in a strictly descending profile", () => {
    expect(detectClimbs(profileOf([1000, ...leg(1000, 20, -5)], 10))).toEqual([]);
  });

  it("finds no segment in a flat profile", () => {
    expect(
      detectClimbs(
        profileOf(
          Array.from({ length: 21 }, () => 1000),
          10,
        ),
      ),
    ).toEqual([]);
  });
});

describe("two neighboring segments merge if the dip separating them is minor", () => {
  const climb = (from: number): number[] => leg(from, 10, 3);

  it("merges across an eight meter dip spread over one hundred and fifty meters", () => {
    const elevations = [1000, ...climb(1000), ...leg(1030, 15, -8 / 15), ...climb(1022)];

    expect(detectClimbs(profileOf(elevations, 10))).toHaveLength(1);
  });

  it("keeps two segments across a twenty five meter dip over the same distance", () => {
    const elevations = [1000, ...climb(1000), ...leg(1030, 15, -25 / 15), ...climb(1005)];

    expect(detectClimbs(profileOf(elevations, 10))).toHaveLength(2);
  });

  it("keeps two segments across an eight meter dip spread over four hundred meters", () => {
    const elevations = [1000, ...climb(1000), ...leg(1030, 40, -8 / 40), ...climb(1022)];

    expect(detectClimbs(profileOf(elevations, 10))).toHaveLength(2);
  });

  it("merges three climbs separated by two minor dips into a single climb", () => {
    const elevations = [
      1000,
      ...climb(1000),
      ...leg(1030, 15, -8 / 15),
      ...climb(1022),
      ...leg(1052, 15, -8 / 15),
      ...climb(1044),
    ];

    expect(detectClimbs(profileOf(elevations, 10))).toHaveLength(1);
  });
});

describe("a segment is kept only if it exceeds the minimum gain and grade", () => {
  it("rejects a fifteen meter climb at five percent, whose gain is too small", () => {
    expect(detectClimbs(profileOf([1000, ...leg(1000, 30, 0.5)], 10))).toEqual([]);
  });

  it("keeps a twenty meter climb at five percent, exactly at the gain threshold", () => {
    expect(detectClimbs(profileOf([1000, ...leg(1000, 40, 0.5)], 10))).toHaveLength(1);
  });

  it("keeps a sixty meter climb over three kilometers, exactly at the grade threshold", () => {
    expect(detectClimbs(profileOf([1000, ...leg(1000, 30, 2)], 100))).toHaveLength(1);
  });

  it("rejects a sixty meter climb over four kilometers, whose grade is too shallow", () => {
    expect(detectClimbs(profileOf([1000, ...leg(1000, 40, 1.5)], 100))).toEqual([]);
  });
});

describe("a segment spans a range of the track that can be read back", () => {
  it("reports indices inside the track, with the start before the end", () => {
    const track = profileOf([1000, ...leg(1000, 40, 0.5)], 10);

    for (const { startIdx, endIdx } of detectClimbs(track)) {
      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(startIdx).toBeLessThan(endIdx);
      expect(endIdx).toBeLessThan(track.length);
    }
  });

  it("reports segments in order, without overlap", () => {
    const segments = detectClimbs(profileOf(SAWTOOTH, 10));

    for (const [index, segment] of segments.entries()) {
      const previous = segments[index - 1];
      if (previous !== undefined) {
        expect(segment.startIdx).toBeGreaterThanOrEqual(previous.endIdx);
      }
    }
  });
});
