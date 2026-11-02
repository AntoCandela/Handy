import { test, expect } from "@playwright/test";
test("shared dropdowns persist independent preferences and removed presets migrate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("handy.appearance.v1"))
      localStorage.setItem(
        "handy.appearance.v1",
        JSON.stringify({ preset: "brutalist", accent: "blue", size: "large" }),
      );
  });
  await page.goto("/tests/fixtures/appearance.html");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "classic",
  );
  await expect(
    page.getByRole("button", { name: "Blue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Large", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neo-Brutalist", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("button", { name: "Paper", exact: true }).click();
  await page.getByRole("button", { name: "Large", exact: true }).click();
  await page.getByRole("button", { name: "Normal", exact: true }).click();
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await page
    .getByRole("button", { name: "Theme default", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "paper",
  );
  await expect(
    page.getByRole("button", { name: "Normal", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dusk", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dusk");
  await page.screenshot({
    path: ".handy-dev.local/appearance-revised-dark.png",
    animations: "disabled",
  });
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.screenshot({
    path: ".handy-dev.local/appearance-revised-light.png",
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Reset style and text size", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "classic",
  );
  expect(
    await page
      .locator("html")
      .evaluate((el) => el.style.getPropertyValue("--light-color-background")),
  ).toBe("");
});
