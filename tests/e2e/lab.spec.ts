import { expect, test } from "@playwright/test";

test("renders the representative matrix with diagnostics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mobile Safari Emulator Lab" })).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(9);
  const capabilities = await page.evaluate(() => window.__EMULATION_LAB__.capabilities());
  expect(capabilities).toMatchObject({ webAssembly: true, crossOriginIsolated: true, sharedArrayBuffer: true });
});

test("boots and measures the bundled NES fixture", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/?system=nes");
  await page.getByRole("button", { name: /Start 240p Test Suite/ }).click();
  await page.waitForFunction(() => window.__EMULATION_LAB__.status === "running", undefined, { timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const result = await page.evaluate(() => window.__EMULATION_LAB__.runSmokeTest(3_000));
  expect(result.systemId).toBe("nes");
  // Shared CI runners can be CPU-throttled below the lab's real-device 45 fps
  // pass gate. This browser check proves sustained execution and rendering;
  // the WIP device runner retains the production performance threshold.
  expect(result.frameDelta, JSON.stringify(result, null, 2)).toBeGreaterThan(90);
  expect(result.measuredFps).toBeGreaterThan(30);
  expect(result.canvas.nonBlank).toBe(true);
  expect(consoleErrors).toEqual([]);
});
