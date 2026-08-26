import { gpx } from "@tmcw/togeojson";
import { GpxError, type Track, type TrackPoint } from "./parser";

type XmlDocument = Parameters<typeof gpx>[0];
export type XmlParser = (xml: string) => XmlDocument;

const browserXmlParser: XmlParser = (xml) =>
  new DOMParser().parseFromString(xml, "application/xml");

const isRejected = (document: XmlDocument): boolean =>
  document.getElementsByTagName("parsererror").length > 0;

type RawPoint = { position: readonly number[]; time: string | undefined };
type Line = { positions: readonly (readonly number[])[]; times: unknown };

const at = (times: unknown, index: number): unknown =>
  Array.isArray(times) ? times[index] : undefined;

const lines = (feature: ReturnType<typeof gpx>["features"][number]): Line[] => {
  const geometry = feature.geometry;
  const times = feature.properties?.coordinateProperties?.times;

  if (geometry === null) {
    return [];
  }
  if (geometry.type === "LineString") {
    return [{ positions: geometry.coordinates, times }];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((positions, index) => ({
      positions,
      times: at(times, index),
    }));
  }
  return [];
};

const rawPoints = (collection: ReturnType<typeof gpx>): RawPoint[] =>
  collection.features.flatMap(lines).flatMap(({ positions, times }) =>
    positions.map((position, index) => {
      const time = at(times, index);
      return { position, time: typeof time === "string" ? time : undefined };
    }),
  );

const toTrackPoint = ({ position, time }: RawPoint): TrackPoint | undefined => {
  const [lon, lat, ele] = position;
  if (lon === undefined || lat === undefined || ele === undefined || time === undefined) {
    return undefined;
  }

  return { lat, lon, ele, time: Temporal.Instant.from(time) };
};

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

export const parseGpx = (xml: string, parseXml: XmlParser = browserXmlParser): Track => {
  const document = parse(xml, parseXml);
  const raw = rawPoints(gpx(document));

  if (raw.length === 0) {
    throw new GpxError("no-track-points");
  }
  if (raw.every(({ position }) => position[2] === undefined)) {
    throw new GpxError("no-elevation");
  }
  if (raw.every(({ time }) => time === undefined)) {
    throw new GpxError("no-time");
  }

  const points = raw.map(toTrackPoint).filter(isDefined);
  const [first, second, ...rest] = points;
  if (first === undefined || second === undefined) {
    throw new GpxError("no-track-points");
  }

  return [first, second, ...rest];
};

const parse = (xml: string, parseXml: XmlParser): XmlDocument => {
  const document = ((): XmlDocument => {
    try {
      return parseXml(xml);
    } catch {
      throw new GpxError("invalid-xml");
    }
  })();

  if (isRejected(document)) {
    throw new GpxError("invalid-xml");
  }

  return document;
};
