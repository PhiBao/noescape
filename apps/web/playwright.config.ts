import { defineConfig } from "@playwright/test";

const previewUrl = process.env.PREVIEW_URL?.trim();
if (previewUrl === undefined || previewUrl === "") {
  throw new Error("PREVIEW_URL must point to the deployed preview");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 120_000 },
  reporter: "list",
  use: {
    baseURL: previewUrl,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
});
