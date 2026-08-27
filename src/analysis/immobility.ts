import { DEFAULTS, type Thresholds } from "../constants";
import { type AtLeastTwo, mapAtLeastTwo } from "../type";
import { haversine } from "./geo";
import type { SmoothedPoint, SmoothedTrack } from "./smooth";

export type AnalysedPoint = SmoothedPoint & { immobile: boolean };
export type AnalysedTrack = AtLeastTwo<AnalysedPoint>;

const ZERO = Temporal.Duration.from({ seconds: 0 });

export function detectImmobility(track: SmoothedTrack, t: Thresholds = DEFAULTS): AnalysedTrack {
  const immobile: boolean[] = track.map(() => false);
  let start = 0;

  while (start < track.length) {
    const anchor = track[start];
    if (anchor === undefined) {
      break;
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

    const held = last.time.since(anchor.time).total("seconds") >= t.stopMinDurationS;

    if (held) {
      for (let index = start; index <= end; index += 1) {
        immobile[index] = true;
      }
      start = end + 1;
    } else {
      start += 1;
    }
  }

  return mapAtLeastTwo(track, (point, index) => ({ ...point, immobile: immobile[index] ?? false }));
}

export function movingTime(track: AnalysedTrack, t: Thresholds = DEFAULTS): Temporal.Duration {
  let moving = ZERO;

  for (let index = 0; index < track.length - 1; index += 1) {
    const from = track[index];
    const to = track[index + 1];
    if (from === undefined || to === undefined) {
      continue;
    }

    const elapsed = to.time.since(from.time);
    const unrecorded = elapsed.total("seconds") > t.recordingGapS;

    if (!(unrecorded || (from.immobile && to.immobile))) {
      moving = moving.add(elapsed);
    }
  }

  return moving;
}
