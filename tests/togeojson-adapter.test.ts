import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { GpxError } from "../src/gpx/parser";
import { parseGpx } from "../src/gpx/togeojson-adapter";
import cyclingGpx from "./fixtures/cycling-anonymised.gpx?raw";
import minimalGpx from "./fixtures/minimal.gpx?raw";

const parse = (xml: string) =>
  parseGpx(xml, (source) => new DOMParser().parseFromString(source, "text/xml"));

const document = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">${body}</gpx>`;

const segment = (points: string): string => document(`<trk><trkseg>${points}</trkseg></trk>`);

const completePoint = (index: number): string =>
  `<trkpt lat="45.${index}" lon="6.${index}"><ele>${1000 + index}</ele><time>2024-01-01T10:00:0${index}Z</time></trkpt>`;

const withoutElevation = `<trkpt lat="45.9" lon="6.9"><time>2024-01-01T10:00:09Z</time></trkpt>`;
const withoutTime = `<trkpt lat="45.9" lon="6.9"><ele>1009</ele></trkpt>`;
const withoutAnyElevation = `${withoutElevation}<trkpt lat="45.8" lon="6.8"><time>2024-01-01T10:00:08Z</time></trkpt>`;
const withoutAnyTime = `${withoutTime}<trkpt lat="45.8" lon="6.8"><ele>1008</ele></trkpt>`;

const codeOf = (parse: () => unknown): string => {
  try {
    parse();
  } catch (error) {
    return error instanceof GpxError ? error.code : `not a GpxError: ${String(error)}`;
  }
  return "no error thrown";
};

describe("a valid GPX becomes a sequence of TrackPoint in the file's order", () => {
  it("returns one point per trkpt, with its coordinates and elevation", () => {
    const track = parse(minimalGpx);

    expect(track.map(({ lat, lon, ele }) => ({ lat, lon, ele }))).toEqual([
      { lat: 45.1, lon: 6.1, ele: 1000 },
      { lat: 45.101, lon: 6.101, ele: 1010.5 },
      { lat: 45.102, lon: 6.102, ele: 1021 },
    ]);
  });

  it("reads each timestamp as an instant", () => {
    const track = parse(minimalGpx);

    expect(track.map((point) => point.time.toString())).toEqual([
      "2024-01-01T10:00:00Z",
      "2024-01-01T10:00:30Z",
      "2024-01-01T10:01:00Z",
    ]);
  });

  it("concatenates two consecutive trkseg into a single sequence", () => {
    const xml = document(
      `<trk><trkseg>${completePoint(0)}${completePoint(1)}</trkseg><trkseg>${completePoint(2)}${completePoint(3)}</trkseg></trk>`,
    );

    expect(parse(xml).map((point) => point.ele)).toEqual([1000, 1001, 1002, 1003]);
  });

  it("reads the whole real recording", () => {
    expect(parse(cyclingGpx)).toHaveLength(3422);
  });
});

describe("failures surface as a GpxError carrying a domain code", () => {
  it("reports invalid-xml for a string that is not XML", () => {
    expect(codeOf(() => parse("certainly not xml"))).toBe("invalid-xml");
  });

  it("reports no-track-points for well-formed XML without a single trkpt", () => {
    expect(codeOf(() => parse(document("<trk><name>Empty</name></trk>")))).toBe("no-track-points");
  });

  it("reports no-elevation when no point carries an ele", () => {
    expect(codeOf(() => parse(segment(withoutAnyElevation)))).toBe("no-elevation");
  });

  it("reports no-time when no point carries a time", () => {
    expect(codeOf(() => parse(segment(withoutAnyTime)))).toBe("no-time");
  });

  it("never leaks a message coming from the underlying library", () => {
    const failures = ["certainly not xml", document("<trk></trk>"), segment(withoutAnyElevation)];

    for (const xml of failures) {
      expect(() => parse(xml)).toThrow(GpxError);
    }
  });
});

describe("partially populated points are ignored without failing the parsing", () => {
  it("keeps the four complete points when one of five has no ele", () => {
    const points = [
      completePoint(0),
      completePoint(1),
      withoutElevation,
      completePoint(2),
      completePoint(3),
    ];

    expect(parse(segment(points.join("")))).toHaveLength(4);
  });

  it("keeps the four complete points when one of five has no time", () => {
    const points = [
      completePoint(0),
      completePoint(1),
      withoutTime,
      completePoint(2),
      completePoint(3),
    ];

    expect(parse(segment(points.join("")))).toHaveLength(4);
  });
});
