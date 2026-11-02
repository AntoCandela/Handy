import { test, expect } from "@playwright/test";
test.setTimeout(90000);
test("saving a correction preserves originals and vocabulary requires approval", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/workspace.html");
  await page
    .getByRole("textbox", { name: "Your transcript", exact: true })
    .fill("I use Handy daily");
  await expect(
    page.getByRole("button", { name: "Close editor", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to vocabulary", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.workspaceCalls)).toEqual([
    "save_transcript_edit",
  ]);
  await page
    .getByRole("button", { name: "Add to vocabulary", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to vocabulary", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.workspaceCalls)).toEqual([
    "save_transcript_edit",
    "custom_words",
  ]);
  await page.getByText("Original recognition results", { exact: true }).click();
  await expect(
    page.getByText("I use handee daily", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export text", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("My recording.txt");
  await page.screenshot({
    path: ".handy-dev.local/workspace-verified.png",
    fullPage: true,
  });
});
test("a conflicting save keeps the user's unsaved draft", async ({ page }) => {
  await page.goto("/tests/fixtures/workspace.html?conflict");
  await page
    .getByRole("textbox", { name: "Your transcript", exact: true })
    .fill("My unsaved correction");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Your transcript", exact: true }),
  ).toHaveValue("My unsaved correction");
  await expect(
    page.getByRole("button", { name: "Close editor", exact: true }),
  ).toBeDisabled();
});

test("drafts survive reopening and stale drafts cannot overwrite saved text", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/workspace.html");
  const transcript = page.getByRole("textbox", {
    name: "Your transcript",
    exact: true,
  });
  await transcript.fill("Keep my draft");
  await page.reload();
  await expect(transcript).toHaveValue("Keep my draft");
  await page.evaluate(() =>
    localStorage.setItem(
      "handy-transcript-draft-1",
      JSON.stringify({
        title: "Older title",
        text: "Old correction",
        revision: -1,
      }),
    ),
  );
  await page.reload();
  await expect(transcript).toHaveValue("Old correction");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "older than the saved version",
  );
  await page
    .getByRole("button", { name: "Discard unsaved changes", exact: true })
    .click();
  await expect(transcript).toHaveValue("I use handee daily");
});

test("local profile checks readiness without changing the saved choice", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/workspace.html?profile");
  await page.getByRole("button", { name: "Check model", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Local model found");
  expect(await page.evaluate(() => window.workspaceCalls)).toEqual([
    "check_writing_model",
  ]);
  await page
    .getByRole("button", { name: "Clean up wording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply profile", exact: true })
    .click();
  await expect(
    page.getByText("Profile saved. Apply changes between recordings.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.workspaceCalls)).toEqual([
    "check_writing_model",
    JSON.stringify({ mode: "cleanup", model: "gemma3:4b" }),
  ]);
  await page.screenshot({
    path: ".handy-dev.local/profiles-verified.png",
    fullPage: true,
  });
});

test("an unavailable local model is reported instead of pretending to be ready", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/workspace.html?profile&unavailable");
  await page.getByRole("button", { name: "Check model", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Local model unavailable",
  );
});
