import {
  accentColors,
  type AccentId,
  type ThemeDefinition,
} from "./definitions";

/** Both the actual UI and previews resolve the same accent override. */
export function resolveTheme(theme: ThemeDefinition, accent: AccentId) {
  const override = accent === "preset" ? null : accentColors[accent];
  return {
    light: { ...theme.light, accent: override?.light ?? theme.light.accent },
    dark: { ...theme.dark, accent: override?.dark ?? theme.dark.accent },
  };
}
export const appearanceProperties = [
  "--light-color-background",
  "--light-color-text",
  "--dark-color-background",
  "--dark-color-text",
  "--light-color-logo-primary",
  "--dark-color-logo-primary",
  "--color-background-ui",
] as const;
export type AppearanceProperty = (typeof appearanceProperties)[number];
export function themeVariables(
  theme: ThemeDefinition,
  accent: AccentId,
): Partial<Record<AppearanceProperty, string>> {
  const resolved = resolveTheme(theme, accent);
  const variables: Partial<Record<AppearanceProperty, string>> = {};
  if (!theme.inheritBase) {
    variables["--light-color-background"] = resolved.light.background;
    variables["--light-color-text"] = resolved.light.text;
    variables["--dark-color-background"] = resolved.dark.background;
    variables["--dark-color-text"] = resolved.dark.text;
  }
  if (!theme.inheritBase || accent !== "preset") {
    variables["--light-color-logo-primary"] = resolved.light.accent;
    variables["--dark-color-logo-primary"] = resolved.dark.accent;
    variables["--color-background-ui"] = resolved.light.accent;
  }
  return variables;
}
export function previewVariables(
  theme: ThemeDefinition,
  accent: AccentId,
): Record<`--preview-${string}`, string> {
  const { light, dark } = resolveTheme(theme, accent);
  return {
    "--preview-light": light.background,
    "--preview-dark": dark.background,
    "--preview-ink-light": light.text,
    "--preview-ink-dark": dark.text,
    "--preview-accent-light": light.accent,
    "--preview-accent-dark": dark.accent,
  };
}
