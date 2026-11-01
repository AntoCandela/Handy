import { test, expect } from "@playwright/test";

test("model filters combine and clearing them restores the catalog", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/models.html");
  const rows = page.locator("[data-row]");
  await expect(rows).toHaveCount(3);
  await page
    .getByRole("button", { name: "Installed (2)", exact: true })
    .click();
  await expect(rows).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Filter models by language" })
    .selectOption("it");
  await expect(rows).toHaveCount(1);
  await page.getByRole("button", { name: "Live preview", exact: true }).click();
  await expect(rows).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(3);
});

test("explicit selection updates the card and menu deletion still requires confirmation", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/models.html");
  const card = page.getByRole("region", { name: "Currently selected" });
  await expect(
    card.getByText("Text after recording", { exact: true }),
  ).toBeVisible();
  const streaming = page.locator('[data-row="fixture-1"]');
  await streaming
    .getByRole("button", { name: "Use model", exact: true })
    .click();
  await expect(card.getByText("Live text", { exact: true })).toBeVisible();
  await streaming.locator("summary").click();
  await streaming.getByRole("button", { name: /Delete/ }).click();
  await expect(
    streaming.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await streaming.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(streaming).toHaveAttribute("aria-checked", "true");
});

test("background transcription keeps the use-model action locked", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/models.html?locked");
  await expect(
    page.getByRole("button", { name: "Use model", exact: true }),
  ).toBeDisabled();
  await expect(page.locator('[data-row="fixture-0"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
});
