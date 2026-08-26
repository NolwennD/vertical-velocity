import { describe, expect, it } from "vitest";
import { haversine } from "../src/analysis/geo";
import type { TrackPoint } from "../src/gpx/parser";

const DEGRE_DE_LATITUDE_M = 111_195;
const TOLERANCE_RELATIVE = 0.001;

const point = (lat: number, lon: number): TrackPoint => ({
  lat,
  lon,
  ele: 0,
  time: new Date(0),
});

describe("haversine rend la distance orthodromique entre deux points, en mètres", () => {
  it("mesure un degré de latitude à 0,1 % près", () => {
    const distance = haversine(point(45, 6), point(46, 6));
    const ecartRelatif = Math.abs(distance - DEGRE_DE_LATITUDE_M) / DEGRE_DE_LATITUDE_M;

    expect(ecartRelatif).toBeLessThan(TOLERANCE_RELATIVE);
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
