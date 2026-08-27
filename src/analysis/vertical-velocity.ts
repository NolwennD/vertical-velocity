import { DEFAULTS, type Thresholds } from "../constants";
import type { Track } from "../gpx/parser";
import { type Climb, detectClimbs } from "./climbs";
import { type AnalysedTrack, detectImmobility, movingTime } from "./immobility";
import { smoothTrack } from "./smooth";

export type Analysis = { track: AnalysedTrack; climbs: readonly Climb[] };

type Figures = {
  gainM: number;
  distanceM: number;
  moving: Temporal.Duration;
  elapsed: Temporal.Duration;
};

export type ClimbStats = Figures & {
  averageGrade: number;
  verticalVelocityMoving: number;
  verticalVelocityElapsed: number;
};

const NOTHING: Figures = {
  gainM: 0,
  distanceM: 0,
  moving: Temporal.Duration.from({ seconds: 0 }),
  elapsed: Temporal.Duration.from({ seconds: 0 }),
};

const perHour = (gain: number, duration: Temporal.Duration): number => {
  const hours = duration.total("hours");
  return hours > 0 ? gain / hours : 0;
};

const figuresOf = (climb: Climb, t: Thresholds): Figures => {
  const start = climb[0];
  const end = climb.at(-1) ?? start;

  return {
    gainM: end.smoothedEle - start.smoothedEle,
    distanceM: end.distanceM - start.distanceM,
    moving: movingTime(climb, t),
    elapsed: end.time.since(start.time),
  };
};

const rated = (figures: Figures): ClimbStats => ({
  ...figures,
  averageGrade: figures.distanceM > 0 ? figures.gainM / figures.distanceM : 0,
  verticalVelocityMoving: perHour(figures.gainM, figures.moving),
  verticalVelocityElapsed: perHour(figures.gainM, figures.elapsed),
});

export function analyseClimbs(climbs: readonly Climb[], t: Thresholds = DEFAULTS): ClimbStats[] {
  return climbs.map((climb) => rated(figuresOf(climb, t)));
}

export function summarise(climbs: readonly Climb[], t: Thresholds = DEFAULTS): ClimbStats {
  return rated(
    climbs.reduce((total, climb) => {
      const figures = figuresOf(climb, t);

      return {
        gainM: total.gainM + figures.gainM,
        distanceM: total.distanceM + figures.distanceM,
        moving: total.moving.add(figures.moving),
        elapsed: total.elapsed.add(figures.elapsed),
      };
    }, NOTHING),
  );
}

export function analyse(points: Track, t: Thresholds = DEFAULTS): Analysis {
  const track = detectImmobility(smoothTrack(points, t), t);

  return { track, climbs: detectClimbs(track, t) };
}
