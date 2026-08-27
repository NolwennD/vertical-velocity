import { DICTIONARIES, isLang, type Lang } from "./dictionaries";
import type { MessageKey } from "./en";

export type { Lang, MessageKey };

export type I18n = {
  lang: Lang;
  t(key: MessageKey): string;
  formatNumber(value: number, digits?: number): string;
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

export function createI18n(lang: Lang): I18n {
  const messages = DICTIONARIES[lang];

  return {
    lang,
    t: (key) => messages[key],
    formatNumber: (value, digits = 0) =>
      new Intl.NumberFormat(lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value),
  };
}
