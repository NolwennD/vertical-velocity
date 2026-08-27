import { EARTH_RADIUS_M } from "../../src/analysis/geo";
import type { TrackPoint } from "../../src/gpx/parser";
import type { AtLeastTwo } from "../../src/type";

export const LATITUDE_DEGREES_PER_METER = 180 / (Math.PI * EARTH_RADIUS_M);

export const pointAt = ({
  meter,
  ele = 0,
  second = 0,
}: {
  meter: number;
  ele?: number;
  second?: number;
}): TrackPoint => ({
  lat: 45 + meter * LATITUDE_DEGREES_PER_METER,
  lon: 6,
  ele,
  time: Temporal.Instant.fromEpochMilliseconds(second * 1000),
});

export const atLeastTwo = <T>(items: readonly T[]): AtLeastTwo<T> => {
  const [first, second, ...rest] = items;
  if (first === undefined || second === undefined) {
    throw new Error("expected at least two items");
  }
  return [first, second, ...rest];
};
