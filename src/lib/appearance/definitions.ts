/** Named semantic tokens, independent of React, storage, and native events. */
export interface ThemeColors {
  readonly background: string;
  readonly text: string;
  readonly accent: string;
}
export interface ThemeDefinition {
  readonly version: 1;
  readonly light: ThemeColors;
  readonly dark: ThemeColors;
  /** Classic inherits upstream CSS defaults instead of pinning inline overrides. */
  readonly inheritBase?: boolean;
}
export const themes = {
  classic: {
    version: 1,
    inheritBase: true,
    light: { background: "#fbfbfb", text: "#0f0f0f", accent: "#faa2ca" },
    dark: { background: "#2c2b29", text: "#fbfbfb", accent: "#f28cbb" },
  },
  slate: {
    version: 1,
    light: { background: "#f4f6fa", text: "#172033", accent: "#2563eb" },
    dark: { background: "#192230", text: "#f3f6fc", accent: "#93b4ff" },
  },
  forest: {
    version: 1,
    light: { background: "#f5f5ee", text: "#203529", accent: "#26734b" },
    dark: { background: "#202b24", text: "#f3f5eb", accent: "#91d5aa" },
  },
  contrast: {
    version: 1,
    light: { background: "#ffffff", text: "#000000", accent: "#174bb8" },
    dark: { background: "#080808", text: "#ffffff", accent: "#a6c4ff" },
  },
  paper: {
    version: 1,
    light: { background: "#faf5eb", text: "#45382b", accent: "#895630" },
    dark: { background: "#302923", text: "#f6ede0", accent: "#dbb38a" },
  },
  dusk: {
    version: 1,
    light: { background: "#f6f3fb", text: "#382c4b", accent: "#7950af" },
    dark: { background: "#272332", text: "#f2edf9", accent: "#c6a5ef" },
  },
} as const satisfies Record<string, ThemeDefinition>;
export type ThemeId = keyof typeof themes;
export const presets = Object.keys(themes) as ThemeId[];
export const accentColors = {
  pink: { light: "#ae2563", dark: "#f69cc5" },
  blue: { light: "#245bc2", dark: "#99baff" },
  green: { light: "#247044", dark: "#8bd6a5" },
  amber: { light: "#885000", dark: "#ffcc70" },
} as const;
export type AccentId = "preset" | keyof typeof accentColors;
export const accents: AccentId[] = [
  "preset",
  ...(Object.keys(accentColors) as (keyof typeof accentColors)[]),
];
export interface Appearance {
  preset: ThemeId;
  accent: AccentId;
  size: "normal" | "large";
}
export const defaultAppearance: Readonly<Appearance> = {
  preset: "classic",
  accent: "preset",
  size: "normal",
};
export const appearanceStorageKey = "handy.appearance.v1";

/** Stored preferences are untrusted; return only the supported fields. */
export function normalizeAppearance(input: unknown): Appearance {
  if (!input || typeof input !== "object") return { ...defaultAppearance };
  const value = input as Record<string, unknown>;
  const preset = value.preset === "brutalist" ? "classic" : value.preset;
  if (
    typeof preset !== "string" ||
    !Object.prototype.hasOwnProperty.call(themes, preset) ||
    typeof value.accent !== "string" ||
    !accents.includes(value.accent as AccentId) ||
    (value.size !== "normal" && value.size !== "large")
  )
    return { ...defaultAppearance };
  return {
    preset: preset as ThemeId,
    accent: value.accent as AccentId,
    size: value.size,
  };
}
