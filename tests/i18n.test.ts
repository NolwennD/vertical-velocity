import { describe, expect, it } from "vitest";
import { createI18n, detectLanguage } from "../src/i18n/index";

describe("the language comes from the stored choice, otherwise from the browser, otherwise English", () => {
  it("takes French from a browser asking for French first", () => {
    expect(detectLanguage(["fr-FR", "en"], null)).toBe("fr");
  });

  it("falls back to English for a browser asking for a language it does not have", () => {
    expect(detectLanguage(["de-DE"], null)).toBe("en");
  });

  it("lets the stored choice win over the browser", () => {
    expect(detectLanguage(["fr-FR"], "en")).toBe("en");
  });

  it("falls back to English for a browser asking for nothing", () => {
    expect(detectLanguage([], null)).toBe("en");
  });

  it("ignores a stored value that names no known language", () => {
    expect(detectLanguage([], "klingon")).toBe("en");
    expect(detectLanguage(["fr"], "klingon")).toBe("fr");
  });
});

describe("each language serves its own dictionary", () => {
  it("answers in English under en", () => {
    expect(createI18n("en").t("table-gain")).toBe("Gain");
  });

  it("answers in French under fr", () => {
    expect(createI18n("fr").t("table-gain")).toBe("Dénivelé");
  });

  it("carries the active language", () => {
    expect(createI18n("fr").lang).toBe("fr");
  });
});

describe("numbers follow the active locale", () => {
  const expected = (lang: string, value: number, digits: number): string =>
    new Intl.NumberFormat(lang, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  it("separates the decimals the English way under en", () => {
    expect(createI18n("en").formatNumber(940.5, 1)).toBe(expected("en", 940.5, 1));
  });

  it("separates the decimals the French way under fr", () => {
    expect(createI18n("fr").formatNumber(940.5, 1)).toBe(expected("fr", 940.5, 1));
  });

  it("rounds to whole numbers when no digits are asked for", () => {
    expect(createI18n("fr").formatNumber(940.5)).toBe(expected("fr", 940.5, 0));
  });
});

describe("durations follow the active locale", () => {
  const expected = (lang: string, duration: Temporal.Duration): string =>
    new Intl.DurationFormat(lang, { style: "narrow" }).format(
      duration.round({ largestUnit: "hours", smallestUnit: "minutes" }),
    );

  const AN_HOUR_AND_FIVE = Temporal.Duration.from({ seconds: 3925 });

  it("names the units the English way under en", () => {
    expect(createI18n("en").formatDuration(AN_HOUR_AND_FIVE)).toBe(
      expected("en", AN_HOUR_AND_FIVE),
    );
  });

  it("names the units the French way under fr", () => {
    expect(createI18n("fr").formatDuration(AN_HOUR_AND_FIVE)).toBe(
      expected("fr", AN_HOUR_AND_FIVE),
    );
  });

  it("drops the seconds, which no rider reads on a climb", () => {
    expect(createI18n("en").formatDuration(Temporal.Duration.from({ seconds: 3929 }))).toBe(
      createI18n("en").formatDuration(AN_HOUR_AND_FIVE),
    );
  });
});

describe("percentages follow the active locale", () => {
  const expected = (lang: string, value: number): string =>
    new Intl.NumberFormat(lang, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);

  it("writes the sign the English way under en", () => {
    expect(createI18n("en").formatPercent(0.075)).toBe(expected("en", 0.075));
  });

  it("writes the sign the French way under fr", () => {
    expect(createI18n("fr").formatPercent(0.075)).toBe(expected("fr", 0.075));
  });

  it("does not write the two languages the same way", () => {
    expect(createI18n("fr").formatPercent(0.075)).not.toBe(createI18n("en").formatPercent(0.075));
  });
});

describe("counted messages agree with the plural rules of the language", () => {
  it("writes one climb in the singular", () => {
    expect(createI18n("en").formatCount("climb-count", 1)).toBe("1 climb");
    expect(createI18n("fr").formatCount("climb-count", 1)).toBe("1 montée");
  });

  it("writes three climbs in the plural", () => {
    expect(createI18n("en").formatCount("climb-count", 3)).toBe("3 climbs");
    expect(createI18n("fr").formatCount("climb-count", 3)).toBe("3 montées");
  });

  it("splits the two languages on zero, singular in French and plural in English", () => {
    expect(createI18n("fr").formatCount("climb-count", 0)).toBe("0 montée");
    expect(createI18n("en").formatCount("climb-count", 0)).toBe("0 climbs");
  });
});
