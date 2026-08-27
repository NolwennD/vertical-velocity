import type { Track, TrackPoint } from "../gpx/parser";
import type { AtLeastTwo } from "../type";

export type MeasuredPoint = TrackPoint & { distanceM: number };
export type MeasuredTrack = AtLeastTwo<MeasuredPoint>;

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

export function withDistances([first, second, ...rest]: Track): MeasuredTrack {
  let total = haversine(first, second);
  const measured: [MeasuredPoint, MeasuredPoint, ...MeasuredPoint[]] = [
    { ...first, distanceM: 0 },
    { ...second, distanceM: total },
  ];
  let previous = second;

  for (const point of rest) {
    total += haversine(previous, point);
    measured.push({ ...point, distanceM: total });
    previous = point;
  }

  return measured;
}
