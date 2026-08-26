export type TrackPoint = {
  lat: number;
  lon: number;
  ele: number;
  time: Date;
};

export type Track = readonly [TrackPoint, TrackPoint, ...TrackPoint[]];

export type GpxErrorCode = "invalid-xml" | "no-track-points" | "no-elevation" | "no-time";

export class GpxError extends Error {
  constructor(readonly code: GpxErrorCode) {
    super(code);
    this.name = "GpxError";
  }
}

export type GpxParser = (xml: string) => Track;
