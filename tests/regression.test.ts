import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { analyse } from "../src/analysis/vertical-velocity";
import { parseGpx } from "../src/gpx/togeojson-adapter";
import realGpx from "./fixtures/real-file-anonymised.gpx?raw";

describe("the real recording keeps the analysis from drifting", () => {
  const { climbs } = analyse(
    parseGpx(realGpx, (xml) => new DOMParser().parseFromString(xml, "text/xml")),
  );

  it("splits the ride into three climbs", () => {
    expect(climbs).toHaveLength(3);
  });

  it("finds immobile points inside the first climb, and none in the other two", () => {
    const immobile = climbs.map((climb) => climb.filter((point) => point.immobile).length);

    expect(immobile[0]).toBeGreaterThan(0);
    expect(immobile.slice(1)).toEqual([0, 0]);
  });
});
