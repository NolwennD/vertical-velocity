import type { I18n } from "../i18n/index";

const SECONDS_PER_HOUR = 3600;
const METERS_PER_KILOMETER = 1000;

export const RADII_M: readonly number[] = [3, 4, 6, 8, 12];

export function mountImmobilitySelect(
  root: HTMLElement,
  i18n: I18n,
  current: number,
  minDurationS: number,
  onChange: (radiusM: number) => void,
): void {
  const label = document.createElement("label");
  label.textContent = i18n.t("immobility-radius");

  const select = document.createElement("select");
  for (const radius of RADII_M) {
    const speed = (radius / minDurationS / METERS_PER_KILOMETER) * SECONDS_PER_HOUR;
    const option = document.createElement("option");
    option.value = String(radius);
    option.textContent = `${i18n.formatNumber(radius)} m (${i18n.formatNumber(speed, 1)} km/h)`;
    option.selected = radius === current;
    select.append(option);
  }

  select.addEventListener("change", () => {
    const chosen = RADII_M.find((radius) => String(radius) === select.value);
    if (chosen !== undefined) {
      onChange(chosen);
    }
  });

  label.append(select);
  root.replaceChildren(label);
}
