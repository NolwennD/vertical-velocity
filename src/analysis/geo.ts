import type { Track, TrackPoint } from "../gpx/parser";
import type { NonEmptyArray } from "../type";

export const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversine(a: TrackPoint, b: TrackPoint): number {
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function cumulativeDistances([first, ...rest]: Track): NonEmptyArray<number> {
  const distances: [number, ...number[]] = [0];
  let previous = first;
  let total = 0;

  for (const point of rest) {
    total += haversine(previous, point);
    distances.push(total);
    previous = point;
  }

  return distances;
}
