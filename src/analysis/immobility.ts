import { DEFAULTS, type Thresholds } from "../constants";
import { type AtLeastTwo, mapAtLeastTwo } from "../type";
import { haversine } from "./geo";
import type { SmoothedPoint, SmoothedTrack } from "./smooth";

export type AnalysedPoint = SmoothedPoint & { immobile: boolean };
export type AnalysedTrack = AtLeastTwo<AnalysedPoint>;

const ZERO = Temporal.Duration.from({ seconds: 0 });

export function detectImmobility(track: SmoothedTrack, t: Thresholds = DEFAULTS): AnalysedTrack {
  const immobile = new Set<number>();
  let resumeAt = 0;

  for (const [start, anchor] of track.entries()) {
    if (start < resumeAt) {
      continue;
    }

    let end = start;
    let last = anchor;
    for (let next = start + 1; next < track.length; next += 1) {
      const candidate = track[next];
      if (candidate === undefined || haversine(anchor, candidate) >= t.stopRadiusM) {
        break;
      }
      end = next;
      last = candidate;
    }

    if (last.time.since(anchor.time).total("seconds") >= t.stopMinDurationS) {
      for (let index = start; index <= end; index += 1) {
        immobile.add(index);
      }
      resumeAt = end + 1;
    }
  }

  return mapAtLeastTwo(track, (point, index) => ({ ...point, immobile: immobile.has(index) }));
}

export function movingTime(track: AnalysedTrack, t: Thresholds = DEFAULTS): Temporal.Duration {
  const [first, ...rest] = track;
  let moving = ZERO;
  let previous = first;

  for (const point of rest) {
    const elapsed = point.time.since(previous.time);
    const unrecorded = elapsed.total("seconds") > t.recordingGapS;

    if (!(unrecorded || (previous.immobile && point.immobile))) {
      moving = moving.add(elapsed);
    }
    previous = point;
  }

  return moving;
}
