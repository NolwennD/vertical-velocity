import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { detectClimbs } from "../src/analysis/climbs";
import { detectImmobility } from "../src/analysis/immobility";
import { smoothTrack } from "../src/analysis/smooth";
import { parseGpx } from "../src/gpx/togeojson-adapter";
import realGpx from "./fixtures/real-file-anonymised.gpx?raw";

describe("the real recording serves as a regression test", () => {
  const realClimbs = detectClimbs(
    detectImmobility(
      smoothTrack(parseGpx(realGpx, (xml) => new DOMParser().parseFromString(xml, "text/xml"))),
    ),
  );

  it("finds a pause inside the first climb, and none in the other two", () => {
    const immobile = realClimbs.map((climb) => climb.filter((point) => point.immobile).length);

    expect(immobile[0]).toBeGreaterThan(0);
    expect(immobile.slice(1)).toEqual([0, 0]);
  });
});
