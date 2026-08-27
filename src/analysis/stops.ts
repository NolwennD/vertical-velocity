import { DEFAULTS, type Thresholds } from "../constants";
import type { Track } from "../gpx/parser";
import { haversine } from "./geo";

export type TimeBreakdown = {
  moving: Temporal.Duration;
  stopped: Temporal.Duration;
  gap: Temporal.Duration;
};

const ZERO = Temporal.Duration.from({ seconds: 0 });

export function findStops(points: Track, t: Thresholds = DEFAULTS): readonly boolean[] {
  const stopped: boolean[] = points.map(() => false);
  let start = 0;

  while (start < points.length) {
    const anchor = points[start];
    if (anchor === undefined) {
      break;
    }

    let end = start;
    let last = anchor;
    for (let next = start + 1; next < points.length; next += 1) {
      const candidate = points[next];
      if (candidate === undefined || haversine(anchor, candidate) >= t.stopRadiusM) {
        break;
      }
      end = next;
      last = candidate;
    }

    const held = last.time.since(anchor.time).total("seconds") >= t.stopMinDurationS;

    if (held) {
      for (let index = start; index <= end; index += 1) {
        stopped[index] = true;
      }
      start = end + 1;
    } else {
      start += 1;
    }
  }

  return stopped;
}

export function timeBreakdown(
  points: Track,
  stopped: readonly boolean[],
  fromIdx: number,
  toIdx: number,
  t: Thresholds = DEFAULTS,
): TimeBreakdown {
  let movingTime = ZERO;
  let stoppedTime = ZERO;
  let gapTime = ZERO;

  for (let index = fromIdx; index < toIdx; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (from === undefined || to === undefined) {
      continue;
    }

    const elapsed = to.time.since(from.time);

    if (elapsed.total("seconds") > t.recordingGapS) {
      gapTime = gapTime.add(elapsed);
    } else if (stopped[index] && stopped[index + 1]) {
      stoppedTime = stoppedTime.add(elapsed);
    } else {
      movingTime = movingTime.add(elapsed);
    }
  }

  return { moving: movingTime, stopped: stoppedTime, gap: gapTime };
}
