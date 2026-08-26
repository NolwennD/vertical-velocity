import { DEFAULTS, type Thresholds } from "../constants";
import type { Track } from "../gpx/parser";

const median = (values: readonly number[]): number | undefined =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const medianFiltered = (elevations: readonly number[], windowPoints: number): number[] => {
  const half = Math.floor(windowPoints / 2);

  return elevations.map((elevation, index) => {
    const radius = Math.min(half, index, elevations.length - 1 - index);
    return median(elevations.slice(index - radius, index + radius + 1)) ?? elevation;
  });
};

const movingAverage = (
  elevations: readonly number[],
  cumulative: readonly number[],
  windowMeter: number,
): number[] => {
  const half = windowMeter / 2;
  const first = cumulative[0];
  const last = cumulative[elevations.length - 1];

  if (first === undefined || last === undefined) {
    return [...elevations];
  }

  const averaged: number[] = [];

  for (const [index, elevation] of elevations.entries()) {
    const centre = cumulative[index];
    if (centre === undefined) {
      averaged.push(elevation);
      continue;
    }

    const radius = Math.min(half, centre - first, last - centre);
    let sum = elevation;
    let count = 1;

    const walk = (step: number): void => {
      for (let other = index + step; other >= 0 && other < elevations.length; other += step) {
        const distance = cumulative[other];
        const value = elevations[other];
        if (distance === undefined || value === undefined || Math.abs(distance - centre) > radius) {
          break;
        }
        sum += value;
        count += 1;
      }
    };

    walk(-1);
    walk(1);

    averaged.push(sum / count);
  }

  return averaged;
};

export function smoothElevations(
  points: Track,
  cumulative: readonly number[],
  t: Thresholds = DEFAULTS,
): readonly number[] {
  const elevations = points.map((point) => point.ele);

  return movingAverage(
    medianFiltered(elevations, t.medianWindowPoints),
    cumulative,
    t.smoothingWindowM,
  );
}
