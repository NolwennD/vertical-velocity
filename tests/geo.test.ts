import { describe, expect, it } from "vitest";
import { cumulativeDistances, haversine } from "../src/analysis/geo";
import type { TrackPoint } from "../src/gpx/parser";

const DEGRE_DE_LATITUDE_M = 111_195;
const TOLERANCE_RELATIVE = 0.001;
// ponytail: ce 6_371_000 duplique EARTH_RADIUS_M, non exporté par geo.ts. L'exporter
// rendrait le test tautologique ; le dupliquer fait échouer la précision millimétrique
// dès que le rayon de l'implémentation bouge. Lequel des deux couplages assume-t-on ?
const METRE_EN_DEGRE_DE_LATITUDE = 180 / (Math.PI * 6_371_000);
const ESPACEMENT_M = 100;
const PRECISION_MILLIMETRIQUE = 3;

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

describe("cumulativeDistances rend un tableau de même longueur que l'entrée, croissant, commençant à 0", () => {
  it("rend [0, ~100, ~200] pour trois points alignés espacés de 100 m", () => {
    const trace = [0, 1, 2].map((rang) =>
      point(45 + rang * ESPACEMENT_M * METRE_EN_DEGRE_DE_LATITUDE, 6),
    );

    expect(cumulativeDistances(trace)).toEqual([
      0,
      expect.closeTo(ESPACEMENT_M, PRECISION_MILLIMETRIQUE),
      expect.closeTo(2 * ESPACEMENT_M, PRECISION_MILLIMETRIQUE),
    ]);
  });

  it("croît d'un point au suivant", () => {
    const trace = [0, 3, 1, 7, 2].map((rang) =>
      point(45 + rang * ESPACEMENT_M * METRE_EN_DEGRE_DE_LATITUDE, 6),
    );

    const distances = cumulativeDistances(trace);

    let precedente = Number.NEGATIVE_INFINITY;

    for (const distance of distances) {
      expect(distance).toBeGreaterThanOrEqual(precedente);
      precedente = distance;
    }
  });

  it("rend [0] pour un seul point", () => {
    expect(cumulativeDistances([point(45, 6)])).toEqual([0]);
  });

  it("rend [] pour un tableau vide", () => {
    expect(cumulativeDistances([])).toEqual([]);
  });
});
