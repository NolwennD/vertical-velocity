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
