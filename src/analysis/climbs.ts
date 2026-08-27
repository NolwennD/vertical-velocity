import { DEFAULTS, type Thresholds } from "../constants";
import { type AtLeastTwo, isAtLeastTwo } from "../type";
import type { AnalysedPoint, AnalysedTrack } from "./stops";

export type Climb = AtLeastTwo<AnalysedPoint>;

type Segment = {
  startIdx: number;
  endIdx: number;
  start: AnalysedPoint;
  end: AnalysedPoint;
};

const rising = (track: AnalysedTrack): Segment[] => {
  const [first, ...rest] = track;
  const segments: Segment[] = [];
  let open: { startIdx: number; start: AnalysedPoint } | undefined;
  let previous = first;

  for (const [offset, current] of rest.entries()) {
    if (current.smoothedEle > previous.smoothedEle) {
      open ??= { startIdx: offset, start: previous };
    } else if (open !== undefined) {
      segments.push({ ...open, endIdx: offset, end: previous });
      open = undefined;
    }
    previous = current;
  }

  if (open !== undefined) {
    segments.push({ ...open, endIdx: track.length - 1, end: previous });
  }

  return segments;
};

const merged = (segments: readonly Segment[], t: Thresholds): Segment[] => {
  const kept: Segment[] = [];

  for (const segment of segments) {
    const previous = kept.at(-1);
    if (previous === undefined) {
      kept.push(segment);
      continue;
    }

    const drop = previous.end.smoothedEle - segment.start.smoothedEle;
    const distance = segment.start.distanceM - previous.end.distanceM;

    if (drop <= t.mergeMaxDropM && distance <= t.mergeMaxDistanceM) {
      kept[kept.length - 1] = {
        startIdx: previous.startIdx,
        endIdx: segment.endIdx,
        start: previous.start,
        end: segment.end,
      };
    } else {
      kept.push(segment);
    }
  }

  return kept;
};

const significant = ({ start, end }: Segment, t: Thresholds): boolean => {
  const gain = end.smoothedEle - start.smoothedEle;
  const distance = end.distanceM - start.distanceM;

  return gain >= t.minClimbGainM && distance > 0 && gain / distance >= t.minClimbGrade;
};

export function detectClimbs(track: AnalysedTrack, t: Thresholds = DEFAULTS): Climb[] {
  return merged(rising(track), t)
    .filter((segment) => significant(segment, t))
    .map(({ startIdx, endIdx }): readonly AnalysedPoint[] => track.slice(startIdx, endIdx + 1))
    .filter(isAtLeastTwo);
}
