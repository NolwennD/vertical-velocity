import { DEFAULTS, type Thresholds } from "../constants";
import type { SmoothedTrack } from "./smooth";

export type Segment = { startIdx: number; endIdx: number };

const rising = (track: SmoothedTrack): Segment[] => {
  const segments: Segment[] = [];
  let startIdx: number | undefined;

  for (let index = 1; index < track.length; index += 1) {
    const previous = track[index - 1];
    const current = track[index];
    if (previous === undefined || current === undefined) {
      continue;
    }

    if (current.smoothedEle > previous.smoothedEle) {
      startIdx ??= index - 1;
    } else if (startIdx !== undefined) {
      segments.push({ startIdx, endIdx: index - 1 });
      startIdx = undefined;
    }
  }

  if (startIdx !== undefined) {
    segments.push({ startIdx, endIdx: track.length - 1 });
  }

  return segments;
};

const merged = (segments: readonly Segment[], track: SmoothedTrack, t: Thresholds): Segment[] => {
  const kept: Segment[] = [];

  for (const segment of segments) {
    const previous = kept.at(-1);
    const top = previous === undefined ? undefined : track[previous.endIdx];
    const bottom = track[segment.startIdx];

    if (previous === undefined || top === undefined || bottom === undefined) {
      kept.push(segment);
      continue;
    }

    const drop = top.smoothedEle - bottom.smoothedEle;
    const distance = bottom.distanceM - top.distanceM;

    if (drop <= t.mergeMaxDropM && distance <= t.mergeMaxDistanceM) {
      kept[kept.length - 1] = { startIdx: previous.startIdx, endIdx: segment.endIdx };
    } else {
      kept.push(segment);
    }
  }

  return kept;
};

const significant = (
  segments: readonly Segment[],
  track: SmoothedTrack,
  t: Thresholds,
): Segment[] =>
  segments.filter((segment) => {
    const start = track[segment.startIdx];
    const end = track[segment.endIdx];
    if (start === undefined || end === undefined) {
      return false;
    }

    const gain = end.smoothedEle - start.smoothedEle;
    const distance = end.distanceM - start.distanceM;

    return gain >= t.minClimbGainM && distance > 0 && gain / distance >= t.minClimbGrade;
  });

export function detectClimbs(track: SmoothedTrack, t: Thresholds = DEFAULTS): Segment[] {
  return significant(merged(rising(track), track, t), track, t);
}
