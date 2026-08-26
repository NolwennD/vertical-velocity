import { describe, expect, it } from "vitest";
import { cumulativeDistances, EARTH_RADIUS_M, haversine } from "../src/analysis/geo";
import type { Track, TrackPoint } from "../src/gpx/parser";

const LATITUDE_DEGREE_METER = 111_195;
const RELATIVE_TOLERANCE = 0.001;
const LATITUDE_DEGREES_PER_METER = 180 / (Math.PI * EARTH_RADIUS_M);
const SPACING_METER = 100;
const MILLIMETER_DIGITS = 3;

const point = (lat: number, lon: number): TrackPoint => ({
  lat,
  lon,
  ele: 0,
  time: new Date(0),
});

describe("haversine rend la distance orthodromique entre deux points, en mètres", () => {
  it("mesure un degré de latitude à 0,1 % près", () => {
    const distance = haversine(point(45, 6), point(46, 6));
    const relativeError = Math.abs(distance - LATITUDE_DEGREE_METER) / LATITUDE_DEGREE_METER;

    expect(relativeError).toBeLessThan(RELATIVE_TOLERANCE);
  });

  // Un degré de longitude vaut `cos(latitude)` degré de latitude : à 60°, le cosinus
  // vaut exactement 1/2, d'où l'attendu à la moitié du degré de latitude.
  it("mesure un degré de longitude à 60° de latitude comme un demi-degré de latitude, à 0,1 % près", () => {
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
