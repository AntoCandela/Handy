import { test, expect } from "@playwright/test";
test("installed picker preserves selection and supports keyboard choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 450, height: 500 });
  await page.goto("/tests/fixtures/model-picker.html");
  const selected = page.getByRole("button", { name: /Parakeet Ultra/ });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(selected).toBeFocused();
  await expect(page.getByText("Installed (3)", { exact: true })).toBeVisible();
  await expect(page.getByText("Live text", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".handy-dev.local/model-picker-verified.png" });
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: /Whisper Large/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.pickedModel)).toBe("fixture-whisper");
  await page.goto("/tests/fixtures/model-picker.html?locked");
  for (const button of await page.getByRole("button").all())
    await expect(button).toBeDisabled();
});
