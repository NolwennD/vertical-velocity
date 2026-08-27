import { DICTIONARIES, isLang, type Lang } from "./dictionaries";
import type { CountKey, MessageKey } from "./en";

export type { CountKey, Lang, MessageKey };

export type I18n = {
  lang: Lang;
  t(key: MessageKey): string;
  formatNumber(value: number, digits?: number): string;
  formatDuration(duration: Temporal.Duration): string;
  formatPercent(fraction: number): string;
  formatCount(key: CountKey, count: number): string;
};

const FALLBACK: Lang = "en";

const asLang = (tag: string | null): Lang | undefined => {
  const primary = tag?.split("-")[0]?.toLowerCase();

  return isLang(primary) ? primary : undefined;
};

export function detectLanguage(languages: readonly string[], stored: string | null): Lang {
  const preferred = languages.map(asLang).find((lang) => lang !== undefined);

  return asLang(stored) ?? preferred ?? FALLBACK;
}

const COUNT_PLACEHOLDER = "{count}";

export function createI18n(lang: Lang): I18n {
  const messages = DICTIONARIES[lang];
  const rules = new Intl.PluralRules(lang);

  const formatNumber = (value: number, digits = 0): string =>
    new Intl.NumberFormat(lang, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  return {
    lang,
    t: (key) => messages[key],
    formatNumber,
    formatCount: (key, count) => {
      const exact = Reflect.get(messages, `${key}-${rules.select(count)}`);
      const message = typeof exact === "string" ? exact : messages[`${key}-other`];

      return message.replace(COUNT_PLACEHOLDER, formatNumber(count));
    },
    formatPercent: (fraction) =>
      new Intl.NumberFormat(lang, {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(fraction),
    formatDuration: (duration) =>
      new Intl.DurationFormat(lang, { style: "narrow" }).format(
        duration.round({ largestUnit: "hours", smallestUnit: "minutes" }),
      ),
  };
}
