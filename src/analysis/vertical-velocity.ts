import { DEFAULTS, type Thresholds } from "../constants";
import type { Track } from "../gpx/parser";
import { type Climb, detectClimbs } from "./climbs";
import { type AnalysedTrack, detectImmobility, movingTime } from "./immobility";
import { smoothTrack } from "./smooth";

export type Analysis = { track: AnalysedTrack; climbs: readonly Climb[] };

export type ClimbStats = {
  verticalVelocityMoving: number;
  verticalVelocityElapsed: number;
  averageGrade: number;
};

const perHour = (gain: number, duration: Temporal.Duration): number => {
  const hours = duration.total("hours");
  return hours > 0 ? gain / hours : 0;
};

const statsOf = (climb: Climb, t: Thresholds): ClimbStats => {
  const start = climb[0];
  const end = climb.at(-1) ?? start;

  const gain = end.smoothedEle - start.smoothedEle;
  const distance = end.distanceM - start.distanceM;
  return {
    verticalVelocityMoving: perHour(gain, movingTime(climb, t)),
    verticalVelocityElapsed: perHour(gain, end.time.since(start.time)),
    averageGrade: gain / distance,
  };
};

export function analyseClimbs(climbs: readonly Climb[], t: Thresholds = DEFAULTS): ClimbStats[] {
  return climbs.map((climb) => statsOf(climb, t));
}

export function analyse(points: Track, t: Thresholds = DEFAULTS): Analysis {
  const track = detectImmobility(smoothTrack(points, t), t);

  return { track, climbs: detectClimbs(track, t) };
}
