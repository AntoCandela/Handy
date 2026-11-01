import { test, expect } from "@playwright/test";
test("compact capture shows readiness and elapsed time; delayed settings cannot resurrect a stopped overlay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 260, height: 70 });
  await page.goto("/tests/fixtures/overlay.html");
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        if (!window.overlayEmit) return false;
        await window.overlayEmit("show-overlay", "recording");
        return !!document.querySelector(".scard");
      }),
    )
    .toBe(true);
  await expect(page.getByRole("status")).toHaveText("Starting microphone");
  await page.evaluate(() => window.overlayEmit("recording-ready", null));
  await expect(page.getByRole("status")).toHaveText("Listening");
  await expect(page.locator(".stimer")).toHaveText("0:01", { timeout: 5000 });
  await expect(page.locator(".stimer")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: ".handy-dev.local/overlay-status-verified.png",
  });
  await page.evaluate(async () => {
    window.delayOverlaySettings();
    await window.overlayEmit("show-overlay", "recording");
    await window.overlayEmit("hide-overlay", null);
    window.releaseOverlaySettings();
  });
  await expect(page.locator(".scard")).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  test(`footer uses readable ${theme} text and separates device metadata`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 470, height: 160 });
    await page.goto(`/tests/fixtures/overlay.html?theme=${theme}`);
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          if (!window.overlayEmit) return false;
          await window.overlayEmit("show-overlay", "streaming");
          return !!document.querySelector(".scard");
        }),
      )
      .toBe(true);
    await page.evaluate(async () => {
      await window.overlayEmit("overlay-layout-custom", true);
      await window.overlayEmit("recording-ready", null);
      await window.overlayEmit("stream-text-event", {
        committed: "The skeleton is used inside of the",
        tentative: "",
      });
    });
    await expect(page.getByRole("status")).toHaveCSS(
      "color",
      theme === "dark" ? "rgb(251, 251, 251)" : "rgb(15, 15, 15)",
    );
    await expect(page.locator(".recording-details")).toBeVisible();
    await expect(page.locator(".recording-model")).toContainText(
      "Local speech model",
    );
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          await window.overlayEmit("recording-ready", null);
          await window.overlayEmit("stream-text-event", {
            committed: "The skeleton is used inside of the",
            tentative: "",
          });
          return document.querySelector("textarea")?.value;
        }),
      )
      .toBe("The skeleton is used inside of the");
    await page.screenshot({
      path: `.handy-dev.local/overlay-footer-${theme}.png`,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 220, height: 160 });
    await expect(page.locator(".recording-details")).toBeHidden();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.locator(".sx")).toBeVisible();
  });
}
