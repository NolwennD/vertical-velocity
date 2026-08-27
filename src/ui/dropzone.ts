import type { I18n } from "../i18n/index";

export function mountDropzone(
  root: HTMLElement,
  i18n: I18n,
  loaded: string | undefined,
  onFile: (file: File) => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".gpx,application/gpx+xml";
  input.hidden = true;

  const zone = document.createElement("button");
  zone.type = "button";
  zone.className = "dropzone";
  zone.textContent = loaded ?? i18n.t("drop-zone");
  zone.classList.toggle("loaded", loaded !== undefined);

  const accept = (file: File | undefined): void => {
    if (file === undefined) {
      return;
    }
    zone.textContent = file.name;
    zone.classList.add("loaded");
    onFile(file);
  };

  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => accept(input.files?.[0]));

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("over");
    accept(event.dataTransfer?.files[0]);
  });

  root.replaceChildren(input, zone);
}
