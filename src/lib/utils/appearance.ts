import { emit, listen } from "@tauri-apps/api/event";
import {
  appearanceStorageKey,
  defaultAppearance,
  normalizeAppearance,
  themes,
  type Appearance,
} from "../appearance/definitions";
import { appearanceProperties, themeVariables } from "../appearance/resolve";
export {
  presets,
  accents,
  defaultAppearance,
  type Appearance,
} from "../appearance/definitions";

export function readAppearance(): Appearance {
  try {
    return normalizeAppearance(
      JSON.parse(localStorage.getItem(appearanceStorageKey) || "null"),
    );
  } catch {
    return { ...defaultAppearance };
  }
}
export function applyAppearance(input: Appearance) {
  const value = normalizeAppearance(input);
  const root = document.documentElement;
  root.dataset.appearance = value.preset;
  root.dataset.textSize = value.size;
  appearanceProperties.forEach((property) =>
    root.style.removeProperty(property),
  );
  Object.entries(themeVariables(themes[value.preset], value.accent)).forEach(
    ([property, color]) => root.style.setProperty(property, color),
  );
}
export async function saveAppearance(input: Appearance) {
  const value = normalizeAppearance(input);
  localStorage.setItem(appearanceStorageKey, JSON.stringify(value));
  applyAppearance(value);
  await emit("appearance-changed", value);
}
export function initializeAppearance() {
  applyAppearance(readAppearance());
  void listen("appearance-changed", () => applyAppearance(readAppearance()));
  window.addEventListener("storage", (event) => {
    if (event.key === appearanceStorageKey) applyAppearance(readAppearance());
  });
}
