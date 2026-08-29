import { expect, test } from "@playwright/test";

const localFixtures = process.env.LOCAL_FIXTURES === "1";
const matrix = [
  ["c64", "Happy Flappy"],
  ["atari2600", "Flappy the Duck"],
  ["nes", "240p Test Suite"],
  ["snes", "BLT"],
  ["genesis", "Mega Flappy Sis"],
  ["gba", "240p Test Suite"],
  ["arcade", "Circus"],
  ["dos", "DOS Lab VGA Demo"],
  ["ps1", "Tetrade"],
] as const;

for (const [systemId, fixtureName] of matrix) {
  test(`boots and measures the local ${systemId} fixture`, async ({ page }) => {
    test.skip(!localFixtures, "Run with LOCAL_FIXTURES=1 after npm run build:local");
    await page.goto(`/?system=${systemId}`);
    const start = page.getByRole("button", { name: new RegExp(`Start ${fixtureName}`, "i") });
    await expect(start).toBeVisible();
    await start.click();
    await page.waitForFunction(() => window.__EMULATION_LAB__.status === "running", undefined, { timeout: 75_000 });
    const result = await page.evaluate(() => window.__EMULATION_LAB__.runSmokeTest(1_500));
    expect(result, JSON.stringify(result, null, 2)).toMatchObject({ status: "passed", systemId });
  });
}
