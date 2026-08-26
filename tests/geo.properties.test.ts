import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { cumulativeDistances, haversine } from "../src/analysis/geo";
import type { Track, TrackPoint } from "../src/gpx/parser";

/** Demi-circonférence terrestre, en mètres : la distance de deux antipodes. */
const DEMI_CIRCONFERENCE_M = Math.PI * 6_371_000;

/**
 * Marge relative des comparaisons de flottants : à quelques ulps d'un pôle,
 * `Math.cos(lat)` vaut ~1e-8 et un ulp de son argument y pèse ~1e-8 en relatif.
 * C'est le pire régime rencontré, la conversion en radians le fixe seule.
 */
const MARGE_RELATIVE = 1e-8;

/**
 * Plancher absolu, un millimètre : loin sous toute précision GPS, mais au-dessus
 * des deux régimes où la marge relative ne mord pas. Aux distances nanométriques
 * du voisinage immédiat d'un pôle, et quand `sin(Δlat/2)²` s'annule par underflow
 * sous ~1e-161 degré — deux côtés à 0 et un troisième non nul — aucune marge
 * proportionnelle ne rattrape l'écart.
 */
const PLANCHER_M = 1e-3;

/**
 * Écart de latitude au-delà duquel deux points sont franchement distincts :
 * 1e-6 degré vaut ~11 cm, très au-dessus du bruit de calcul. En deçà, deux points
 * différents peuvent rendre une distance qui s'annule par underflow.
 */
const ECART_DISTINCT_DEG = 1e-6;

const pointArbitraire = fc
  .record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lon: fc.double({ min: -180, max: 180, noNaN: true }),
  })
  .map(({ lat, lon }): TrackPoint => ({ lat, lon, ele: 0, time: new Date(0) }));

/**
 * Deux points obligatoires plus un reste de longueur libre : `fc.array` seul
 * rendrait un `TrackPoint[]`, dont le compilateur ignore la longueur. Le tuple
 * de `fc.tuple` se réétale en la forme exacte de `Track`, sans un seul `as`.
 */
const traceArbitraire = fc
  .tuple(pointArbitraire, pointArbitraire, fc.array(pointArbitraire, { maxLength: 48 }))
  .map(([premier, deuxieme, reste]): Track => [premier, deuxieme, ...reste]);

describe("haversine, propriétés d'une distance sur la sphère", () => {
  it("ne rend jamais de distance négative", () => {
    fc.assert(
      fc.property(pointArbitraire, pointArbitraire, (a, b) => {
        expect(haversine(a, b)).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("rend la même distance quel que soit l'ordre des deux points", () => {
    fc.assert(
      fc.property(pointArbitraire, pointArbitraire, (a, b) => {
        expect(haversine(a, b)).toBe(haversine(b, a));
      }),
    );
  });

  it("s'annule entre deux points identiques, et reste strictement positive dès que les latitudes diffèrent franchement", () => {
    fc.assert(
      fc.property(pointArbitraire, (a) => {
        expect(haversine(a, { ...a })).toBe(0);
      }),
    );

    fc.assert(
      fc.property(pointArbitraire, pointArbitraire, (a, b) => {
        fc.pre(Math.abs(a.lat - b.lat) >= ECART_DISTINCT_DEG);
        expect(haversine(a, b)).toBeGreaterThan(0);
      }),
    );
  });

  it("respecte l'inégalité triangulaire", () => {
    fc.assert(
      fc.property(pointArbitraire, pointArbitraire, pointArbitraire, (a, b, c) => {
        const detour = haversine(a, b) + haversine(b, c);

        expect(haversine(a, c)).toBeLessThanOrEqual(detour + MARGE_RELATIVE * detour + PLANCHER_M);
      }),
    );
  });

  it("ne dépasse jamais la demi-circonférence terrestre", () => {
    fc.assert(
      fc.property(pointArbitraire, pointArbitraire, (a, b) => {
        expect(haversine(a, b)).toBeLessThanOrEqual(
          DEMI_CIRCONFERENCE_M + MARGE_RELATIVE * DEMI_CIRCONFERENCE_M,
        );
      }),
    );
  });
});

describe("cumulativeDistances, propriétés d'une distance cumulée le long d'une trace", () => {
  it("rend un tableau de la longueur de l'entrée", () => {
    fc.assert(
      fc.property(traceArbitraire, (trace) => {
        expect(cumulativeDistances(trace)).toHaveLength(trace.length);
      }),
    );
  });

  it("commence par 0", () => {
    fc.assert(
      fc.property(traceArbitraire, (trace) => {
        expect(cumulativeDistances(trace)[0]).toBe(0);
      }),
    );
  });

  it("croît au sens large d'un point au suivant", () => {
    fc.assert(
      fc.property(traceArbitraire, (trace) => {
        let precedente = Number.NEGATIVE_INFINITY;

        for (const distance of cumulativeDistances(trace)) {
          expect(distance).toBeGreaterThanOrEqual(precedente);
          precedente = distance;
        }
      }),
    );
  });

  /**
   * La ligne brisée ne coupe jamais au plus court : le cumul final majore la corde
   * du premier au dernier point. Relation géométrique, pas la définition du cumul —
   * elle ne rejoue ni l'accumulation ni son ordre. Les deux `Number.NaN` couvrent
   * un tableau vide que le type interdit : ils font échouer, ils ne masquent rien.
   */
  it("finit sur au moins la distance directe entre le premier et le dernier point", () => {
    fc.assert(
      fc.property(traceArbitraire, (trace) => {
        const [premier] = trace;
        const dernier = trace.at(-1);
        const corde = dernier === undefined ? Number.NaN : haversine(premier, dernier);
        const cumulee = cumulativeDistances(trace).at(-1) ?? Number.NaN;

        expect(corde).toBeLessThanOrEqual(cumulee + MARGE_RELATIVE * cumulee + PLANCHER_M);
      }),
    );
  });
});
