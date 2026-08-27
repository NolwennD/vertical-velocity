import { isLang, LANGS, type Lang } from "../i18n/dictionaries";
import type { I18n } from "../i18n/index";

const LABELS: Record<Lang, string> = { en: "English", fr: "Français" };

export function mountLanguageSelect(
  root: HTMLElement,
  i18n: I18n,
  onChange: (lang: Lang) => void,
): void {
  const label = document.createElement("label");
  label.textContent = i18n.t("language");

  const select = document.createElement("select");
  for (const lang of LANGS) {
    const option = document.createElement("option");
    option.value = lang;
    option.textContent = LABELS[lang];
    option.selected = lang === i18n.lang;
    select.append(option);
  }

  select.addEventListener("change", () => {
    if (isLang(select.value)) {
      onChange(select.value);
    }
  });

  label.append(select);
  root.replaceChildren(label);
}
