import { expect, test } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

test("guest opens a case, sends one turn and sees a real stamp", async ({ page }) => {
  const supplied = process.env.E2E_BURNER_KEY?.trim();
  if (supplied === undefined || supplied === "") {
    test.skip(true, "E2E_BURNER_KEY must hold a funded test burner with no active case");
  }
  const burnerKey = supplied ?? "";

  // Fresh browser context, no wallet extension: only the burner key is seeded.
  await page.addInitScript(
    ([value]) => window.localStorage.setItem("noescape.detective.v1", value),
    [burnerKey],
  );
  await page.goto("/");
  // Wait for the active-case lookup before choosing a control: the title briefly
  // shows "Take the case" while daily state is still loading.
  await page.waitForTimeout(8000);

  const resume = page.getByRole("link", { name: /Resume case/ });
  if (await resume.count()) {
    await resume.click();
  } else {
    await page.getByRole("button", { name: "Take the case" }).click();
  }
  await expect(page).toHaveURL(/\/case\/\d+/, { timeout: 120_000 });

  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.count()) await gotIt.click();
  const send = page.getByRole("button", { name: "Send orders" });
  await expect(send).toBeVisible({ timeout: 60_000 });
  await send.click();

  // A relayer request can fail transiently; use the UI's own recovery once,
  // then require a real decrypted stamp within 120 s.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await expect
        .poll(
          async () =>
            page
              .locator("svg text")
              .filter({ hasText: /NOTHING|COLD|FRESH/ })
              .count(),
          { timeout: 120_000, intervals: [1000, 2000, 5000] },
        )
        .toBeGreaterThan(0);
      break;
    } catch (error) {
      const tryAgain = page.getByRole("button", { name: "Try again" });
      if (attempt === 1 || !(await tryAgain.count())) throw error;
      await tryAgain.click();
      if (await send.count()) await send.click();
    }
  }
  await expect(page.getByText(/ADA SEARCHED|BRAM SEARCHED|COLE SEARCHED/).first()).toBeVisible();
});
