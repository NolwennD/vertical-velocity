import { en, type MessageKey } from "./en";
import { fr } from "./fr";

export const DICTIONARIES = { en, fr } satisfies Record<string, Record<MessageKey, string>>;

export type Lang = keyof typeof DICTIONARIES;

export const isLang = (value: string | undefined): value is Lang =>
  value !== undefined && Object.hasOwn(DICTIONARIES, value);

export const LANGS: readonly Lang[] = Object.keys(DICTIONARIES).filter(isLang);
