import type { Track, TrackPoint } from "../gpx/parser";

/** Rayon moyen de la Terre, en mètres. */
const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Distance orthodromique entre deux points, en mètres. Les écarts n'y entrent
 * qu'au carré : `haversine(a, b) === haversine(b, a)`, bit pour bit.
 */
export function haversine(a: TrackPoint, b: TrackPoint): number {
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Distance parcourue depuis le premier point, en mètres, pour chaque point de
 * la trace. Même longueur que l'entrée, commence à 0, croissante.
 */
export function cumulativeDistances(points: Track): number[] {
  const distances: number[] = [];
  let total = 0;
  // Une `Track` a toujours un premier point : le prendre pour prédécesseur initial
  // ôte le cas absurde du `undefined`, et le premier tour ajoute `haversine(p, p)`,
  // c'est-à-dire 0 exactement.
  let previous = points[0];

  for (const point of points) {
    total += haversine(previous, point);
    distances.push(total);
    previous = point;
  }

  return distances;
}
