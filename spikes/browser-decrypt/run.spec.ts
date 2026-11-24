import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

let server: ChildProcess | undefined;

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4387");
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("vite preview did not start");
}

test.beforeAll(async () => {
  execFileSync("pnpm", ["build"], { cwd: process.cwd(), stdio: "inherit" });
  server = spawn("pnpm", ["preview", "--host", "127.0.0.1", "--port", "4387", "--strictPort"], {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "pipe"],
  });
  await waitForServer();
});

test.afterAll(() => {
  server?.kill("SIGTERM");
});

test("public decrypt, KMS check, allowed code and position refusal", async ({ page }) => {
  test.setTimeout(180_000);
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`BROWSER ERROR: ${message.text()}`);
  });

  await page.goto("http://127.0.0.1:4387");
  await expect(page.getByTestId("burner-address")).not.toHaveText("generating…");
  const burner = (await page.getByTestId("burner-address").textContent())?.trim();
  if (burner === undefined || !burner.startsWith("0x")) throw new Error("missing burner address");

  await expect(page.getByTestId("public-result")).toContainText("PUBLIC OK", { timeout: 120_000 });
  await expect(page.getByTestId("check-result")).toContainText("CHECK OK", { timeout: 120_000 });
  console.log(`PUBLIC ${await page.getByTestId("public-result").textContent()}`);
  console.log(`CHECK ${await page.getByTestId("check-result").textContent()}`);

  const repoRoot = path.resolve(process.cwd(), "../..");
  execFileSync(
    "pnpm",
    ["-F", "contracts", "exec", "hardhat", "spike:allow", "--network", "sepolia", "--to", burner],
    { cwd: repoRoot, encoding: "utf8", timeout: 120_000 },
  );

  await page.getByTestId("decrypt-code").click();
  await expect(page.getByTestId("code-result")).toContainText("CODE OK", { timeout: 120_000 });
  console.log(`CODE ${await page.getByTestId("code-result").textContent()}`);

  await page.getByTestId("decrypt-position").click();
  await expect(page.getByTestId("position-result")).toContainText("REFUSED", { timeout: 120_000 });
  console.log(`POSITION ${await page.getByTestId("position-result").textContent()}`);

  console.log(`REQUEST_HOSTS ${JSON.stringify([...hosts].sort())}`);
  console.log(`BURNER ${burner}`);
});
