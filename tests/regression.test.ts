import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { analyse, analyseClimbs } from "../src/analysis/vertical-velocity";
import { parseGpx } from "../src/gpx/togeojson-adapter";
import cyclingGpx from "./fixtures/cycling-anonymised.gpx?raw";
import walkGpx from "./fixtures/walk-anonymised.gpx?raw";

const parse = (xml: string) =>
  parseGpx(xml, (source) => new DOMParser().parseFromString(source, "text/xml"));

describe("the recorded ride keeps the analysis from drifting", () => {
  const { climbs } = analyse(parse(cyclingGpx));

  it("splits the ride into three climbs", () => {
    expect(climbs).toHaveLength(3);
  });

  it("finds immobile points inside the first climb, and none in the other two", () => {
    const immobile = climbs.map((climb) => climb.filter((point) => point.immobile).length);

    expect(immobile[0]).toBeGreaterThan(0);
    expect(immobile.slice(1)).toEqual([0, 0]);
  });
});

describe("the recorded walk is read at a walking pace", () => {
  const { climbs } = analyse(parse(walkGpx));

  it("reads the ascent as a single climb", () => {
    expect(climbs).toHaveLength(1);
  });

  it("never credits the walker with a pace no walker holds uphill", () => {
    for (const stats of analyseClimbs(climbs)) {
      const hours = stats.moving.total("hours");

      expect(stats.distanceM / 1000 / hours).toBeLessThan(5);
    }
  });
});
