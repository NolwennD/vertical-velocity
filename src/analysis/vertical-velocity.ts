import { DEFAULTS, type Thresholds } from "../constants";
import type { Climb } from "./climbs";
import { movingTime } from "./immobility";

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
