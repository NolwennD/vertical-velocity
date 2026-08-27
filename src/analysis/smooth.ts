import { DEFAULTS, type Thresholds } from "../constants";
import type { Track, TrackPoint } from "../gpx/parser";
import { type AtLeastTwo, mapAtLeastTwo } from "../type";
import { cumulativeDistances } from "./geo";

export type SmoothedPoint = TrackPoint & { smoothedEle: number; distanceM: number };
export type SmoothedTrack = AtLeastTwo<SmoothedPoint>;

const median = (values: readonly number[]): number | undefined =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const medianFiltered = (track: SmoothedTrack, windowPoints: number): SmoothedTrack => {
  const half = Math.floor(windowPoints / 2);

  return mapAtLeastTwo(track, (point, index) => {
    const radius = Math.min(half, index, track.length - 1 - index);
    const window = track
      .slice(index - radius, index + radius + 1)
      .map((other) => other.smoothedEle);
    return { ...point, smoothedEle: median(window) ?? point.smoothedEle };
  });
};

const movingAverage = (track: SmoothedTrack, windowMeter: number): SmoothedTrack => {
  const half = windowMeter / 2;
  const start = track[0].distanceM;
  const end = track.at(-1)?.distanceM ?? start;

  return mapAtLeastTwo(track, (point, index) => {
    const centre = point.distanceM;
    const radius = Math.min(half, centre - start, end - centre);
    let sum = point.smoothedEle;
    let count = 1;

    const walk = (step: number): void => {
      for (let other = index + step; other >= 0 && other < track.length; other += step) {
        const neighbour = track[other];
        if (neighbour === undefined || Math.abs(neighbour.distanceM - centre) > radius) {
          break;
        }
        sum += neighbour.smoothedEle;
        count += 1;
      }
    };

    walk(-1);
    walk(1);

    return { ...point, smoothedEle: sum / count };
  });
};

export function smoothTrack(points: Track, t: Thresholds = DEFAULTS): SmoothedTrack {
  const cumulative = cumulativeDistances(points);
  const enriched = mapAtLeastTwo(points, (point, index) => ({
    ...point,
    distanceM: cumulative[index] ?? 0,
    smoothedEle: point.ele,
  }));

  return movingAverage(medianFiltered(enriched, t.medianWindowPoints), t.smoothingWindowM);
}
