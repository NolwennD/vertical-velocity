import { describe, expect, it } from "vitest";
import { cumulativeDistances, haversine } from "../src/analysis/geo";
import type { Track, TrackPoint } from "../src/gpx/parser";
import { LATITUDE_DEGREES_PER_METER } from "./helpers/track";

const LATITUDE_DEGREE_METER = 111_195;
const RELATIVE_TOLERANCE = 0.001;
const SPACING_METER = 100;
const MILLIMETER_DIGITS = 3;

const point = (lat: number, lon: number): TrackPoint => ({
  lat,
  lon,
  ele: 0,
  time: Temporal.Instant.fromEpochMilliseconds(0),
});

describe("haversine returns the great-circle distance between two points, in meters", () => {
  it("measures one degree of latitude to within 0.1%", () => {
    const distance = haversine(point(45, 6), point(46, 6));
    const relativeError = Math.abs(distance - LATITUDE_DEGREE_METER) / LATITUDE_DEGREE_METER;

    expect(relativeError).toBeLessThan(RELATIVE_TOLERANCE);
  });

  it("measures one degree of longitude at 60° latitude as half a degree of latitude, to within 0.1%", () => {
    const expected = LATITUDE_DEGREE_METER / 2;
    const distance = haversine(point(60, 6), point(60, 7));
    const relativeError = Math.abs(distance - expected) / expected;

    expect(relativeError).toBeLessThan(RELATIVE_TOLERANCE);
  });

  it("rend 0 entre deux points identiques", () => {
    expect(haversine(point(45, 6), point(45, 6))).toBe(0);
  });

  it("rend le même résultat quel que soit l'ordre des arguments", () => {
    const a = point(45.1, 6.2);
    const b = point(45.9, 6.8);

    expect(haversine(a, b)).toBe(haversine(b, a));
  });
});

/** Point de la trace au rang donné : `rang` fois 100 m plus au nord que le premier. */
const pointAtIndex = (index: number): TrackPoint =>
  point(45 + index * SPACING_METER * LATITUDE_DEGREES_PER_METER, 6);

describe("cumulativeDistances rend une distance par point de la trace, commençant à 0 et croissante", () => {
  it("rend [0, ~100, ~200] pour trois points alignés espacés de 100 m", () => {
    const track: Track = [pointAtIndex(0), pointAtIndex(1), pointAtIndex(2)];

    expect(cumulativeDistances(track)).toEqual([
      0,
      expect.closeTo(SPACING_METER, MILLIMETER_DIGITS),
      expect.closeTo(2 * SPACING_METER, MILLIMETER_DIGITS),
    ]);
  });

  it("croît d'un point au suivant", () => {
    const track: Track = [
      pointAtIndex(0),
      pointAtIndex(3),
      pointAtIndex(1),
      pointAtIndex(7),
      pointAtIndex(2),
    ];

    const distances = cumulativeDistances(track);

    let previous = Number.NEGATIVE_INFINITY;

    for (const distance of distances) {
      expect(distance).toBeGreaterThanOrEqual(previous);
      previous = distance;
    }
  });
});
