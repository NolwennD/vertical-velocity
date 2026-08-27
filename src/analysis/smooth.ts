import { DEFAULTS, type Thresholds } from "../constants";
import type { Track, TrackPoint } from "../gpx/parser";
import type { AtLeastTwo } from "../type";
import { cumulativeDistances } from "./geo";

export type SmoothedPoint = TrackPoint & { smoothedEle: number; distanceM: number };
export type SmoothedTrack = AtLeastTwo<SmoothedPoint>;

type Sample = { distanceM: number; ele: number };

const median = (values: readonly number[]): number | undefined =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const medianFiltered = (samples: readonly Sample[], windowPoints: number): Sample[] => {
  const half = Math.floor(windowPoints / 2);

  return samples.map((sample, index) => {
    const radius = Math.min(half, index, samples.length - 1 - index);
    const window = samples.slice(index - radius, index + radius + 1).map((other) => other.ele);
    return { ...sample, ele: median(window) ?? sample.ele };
  });
};

const movingAverage = (samples: readonly Sample[], windowMeter: number): Sample[] => {
  const half = windowMeter / 2;
  const start = samples.at(0)?.distanceM ?? 0;
  const end = samples.at(-1)?.distanceM ?? 0;
  const averaged: Sample[] = [];

  for (const [index, sample] of samples.entries()) {
    const centre = sample.distanceM;
    const radius = Math.min(half, centre - start, end - centre);
    let sum = sample.ele;
    let count = 1;

    const walk = (step: number): void => {
      for (let other = index + step; other >= 0 && other < samples.length; other += step) {
        const neighbour = samples[other];
        if (neighbour === undefined || Math.abs(neighbour.distanceM - centre) > radius) {
          break;
        }
        sum += neighbour.ele;
        count += 1;
      }
    };

    walk(-1);
    walk(1);

    averaged.push({ ...sample, ele: sum / count });
  }

  return averaged;
};

export function smoothTrack(points: Track, t: Thresholds = DEFAULTS): SmoothedTrack {
  const cumulative = cumulativeDistances(points);
  const samples = points.map((point, index) => ({
    distanceM: cumulative[index] ?? 0,
    ele: point.ele,
  }));
  const smoothed = movingAverage(medianFiltered(samples, t.medianWindowPoints), t.smoothingWindowM);

  const merge = (point: TrackPoint, index: number): SmoothedPoint => {
    const sample = smoothed[index];
    return { ...point, smoothedEle: sample?.ele ?? point.ele, distanceM: sample?.distanceM ?? 0 };
  };

  const [first, second, ...rest] = points;

  return [
    merge(first, 0),
    merge(second, 1),
    ...rest.map((point, index) => merge(point, index + 2)),
  ];
}
