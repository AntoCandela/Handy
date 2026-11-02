import { test, expect } from "@playwright/test";
import {
  normalizeAppearance,
  themes,
  type ThemeDefinition,
} from "../src/lib/appearance/definitions";
import {
  previewVariables,
  themeVariables,
} from "../src/lib/appearance/resolve";

test("appearance preferences reject unknown IDs and strip unrelated saved fields", () => {
  for (const preset of ["constructor", "__proto__", "missing"]) {
    expect(
      normalizeAppearance({ preset, accent: "blue", size: "large" }),
    ).toEqual({ preset: "classic", accent: "preset", size: "normal" });
  }
  expect(
    normalizeAppearance({
      preset: "brutalist",
      accent: "blue",
      size: "large",
      injected: "ignored",
    }),
  ).toEqual({ preset: "classic", accent: "blue", size: "large" });
});

test("a theme definition resolves without adding a preset-specific branch", () => {
  const custom: ThemeDefinition = {
    version: 1,
    light: { background: "#ffffff", text: "#111111", accent: "#990000" },
    dark: { background: "#111111", text: "#ffffff", accent: "#ffaaaa" },
  };
  const result = themeVariables(custom, "blue");
  expect(result["--light-color-background"]).toBe("#ffffff");
  expect(result["--dark-color-text"]).toBe("#ffffff");
  expect(result["--light-color-logo-primary"]).toBe("#245bc2");
  expect(previewVariables(custom, "blue")["--preview-accent-dark"]).toBe(
    result["--dark-color-logo-primary"],
  );
  expect(custom.light.accent).toBe("#990000");
  expect(themeVariables(themes.classic, "preset")).toEqual({});
});

test("selected previews and applied tokens agree across built-in themes", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/appearance.html");
  for (const name of ["Slate", "Forest", "High Contrast", "Paper", "Dusk"]) {
    const card = page.getByRole("button", { name, exact: true });
    await card.click();
    const colors = await card
      .locator(".appearance-preview")
      .evaluate((preview) => {
        const style = (preview as HTMLElement).style;
        const root = document.documentElement.style;
        return {
          preview: [
            style.getPropertyValue("--preview-light"),
            style.getPropertyValue("--preview-dark"),
            style.getPropertyValue("--preview-accent-dark"),
          ],
          actual: [
            root.getPropertyValue("--light-color-background"),
            root.getPropertyValue("--dark-color-background"),
            root.getPropertyValue("--dark-color-logo-primary"),
          ],
        };
      });
    expect(colors.preview).toEqual(colors.actual);
  }
  await page
    .getByRole("button", { name: "Theme default", exact: true })
    .click();
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  const preview = page
    .getByRole("button", { name: "Dusk", exact: true })
    .locator(".appearance-preview");
  expect(
    await preview.evaluate((el) =>
      (el as HTMLElement).style.getPropertyValue("--preview-accent-light"),
    ),
  ).toBe("#245bc2");
  expect(
    await page
      .locator("html")
      .evaluate((el) => el.style.getPropertyValue("--color-background-ui")),
  ).toBe("#245bc2");
});
