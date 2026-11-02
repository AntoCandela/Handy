import { emit, listen } from "@tauri-apps/api/event";
export const presets = [
  "classic",
  "slate",
  "forest",
  "contrast",
  "paper",
  "dusk",
] as const;
export const accents = ["preset", "pink", "blue", "green", "amber"] as const;
export type Appearance = {
  preset: (typeof presets)[number];
  accent: (typeof accents)[number];
  size: "normal" | "large";
};
export const defaultAppearance: Appearance = {
  preset: "classic",
  accent: "preset",
  size: "normal",
};
const key = "handy.appearance.v1";
export function readAppearance(): Appearance {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    if (value?.preset === "brutalist") value.preset = "classic";
    if (
      value &&
      presets.includes(value.preset) &&
      accents.includes(value.accent) &&
      ["normal", "large"].includes(value.size)
    )
      return value;
  } catch {
    /* Use defaults for unavailable or invalid storage. */
  }
  return { ...defaultAppearance };
}
export const palettes = {
  classic: ["#fbfbfb", "#0f0f0f", "#2c2b29", "#fbfbfb", "#faa2ca", "#f28cbb"],
  slate: ["#f4f6fa", "#172033", "#192230", "#f3f6fc", "#2563eb", "#93b4ff"],
  forest: ["#f5f5ee", "#203529", "#202b24", "#f3f5eb", "#26734b", "#91d5aa"],
  contrast: ["#ffffff", "#000000", "#080808", "#ffffff", "#174bb8", "#a6c4ff"],
  paper: ["#faf5eb", "#45382b", "#302923", "#f6ede0", "#895630", "#dbb38a"],
  dusk: ["#f6f3fb", "#382c4b", "#272332", "#f2edf9", "#7950af", "#c6a5ef"],
};
export const accentColors = {
  pink: ["#ae2563", "#f69cc5"],
  blue: ["#245bc2", "#99baff"],
  green: ["#247044", "#8bd6a5"],
  amber: ["#885000", "#ffcc70"],
};
const tokens = [
  "light-color-background",
  "light-color-text",
  "dark-color-background",
  "dark-color-text",
  "light-color-logo-primary",
  "dark-color-logo-primary",
];
export function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  root.dataset.appearance = value.preset;
  root.dataset.textSize = value.size;
  root.style.removeProperty("--color-background-ui");
  tokens.forEach((token) => root.style.removeProperty(`--${token}`));
  if (value.preset !== "classic")
    palettes[value.preset].forEach((color, i) =>
      root.style.setProperty(`--${tokens[i]}`, color),
    );
  if (value.preset !== "classic")
    root.style.setProperty("--color-background-ui", palettes[value.preset]![4]);
  if (value.accent !== "preset") {
    const colors = accentColors[value.accent];
    root.style.setProperty("--color-background-ui", colors[0]);
    root.style.setProperty("--light-color-logo-primary", colors[0]);
    root.style.setProperty("--dark-color-logo-primary", colors[1]);
  }
}
export async function saveAppearance(value: Appearance) {
  localStorage.setItem(key, JSON.stringify(value));
  applyAppearance(value);
  await emit("appearance-changed", value);
}
export function initializeAppearance() {
  applyAppearance(readAppearance());
  void listen("appearance-changed", () => applyAppearance(readAppearance()));
  window.addEventListener("storage", (event) => {
    if (event.key === key) applyAppearance(readAppearance());
  });
}
