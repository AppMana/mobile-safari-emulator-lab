import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strToU8, zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "public", "fixtures");
const fixtures = [
  {
    file: "240pee.nes",
    url: "https://raw.githubusercontent.com/christopherpow/nes-test-roms/master/240pee/240pee.nes",
    sha256: "228a370b32daacec4c95927aa18243a57be2d45d1d038479ba9d4bb19d05985e",
  },
  {
    file: "240p-test-suite.gba",
    url: "https://raw.githubusercontent.com/mechanize-work/gba-eval/main/corpus/roms/test/misc/240p-test-suite.gba",
    sha256: "47844f7140738a06f8f3bc09780da3ab095539a250b870f614feed561d9d6f34",
  },
  {
    file: "TETRADE_PSX.bin",
    url: "https://github.com/Logan-Campbell/Tetrade/releases/download/v1.0/TETRADE_PSX.bin",
    sha256: "2f41feba2023cbdcd9c1c3d4cfc3d8d1a7f1a2de0afea2e7a050b84640d6eaf8",
  },
];

await mkdir(fixtureDir, { recursive: true });
for (const fixture of fixtures) {
  const response = await fetch(fixture.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to fetch ${fixture.url}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(data).digest("hex");
  if (fixture.sha256 !== "pending" && digest !== fixture.sha256) {
    throw new Error(`${fixture.file} checksum mismatch: expected ${fixture.sha256}, got ${digest}`);
  }
  await writeFile(path.join(fixtureDir, fixture.file), data);
  console.log(`${fixture.file} ${digest}`);
}

const dosProgram = Buffer.from("uBMAzRC4AKCOwDHbMf+5APqJ+DDgANiq4vf+w+RgPAF16rgDAM0Qww==", "base64");
const dosArchive = zipSync({
  "LAB.COM": new Uint8Array(dosProgram),
  "AUTOEXEC.BAT": strToU8("@echo off\r\nLAB.COM\r\n"),
}, { level: 9, mtime: new Date("2000-01-01T00:00:00Z") });
await writeFile(path.join(fixtureDir, "dos-lab.zip"), dosArchive);

const manifest = await Promise.all(fixtures.map(async ({ file, url }) => {
  const data = await readFile(path.join(fixtureDir, file));
  return { file, url, sha256: createHash("sha256").update(data).digest("hex"), bytes: data.length };
}));
const dosData = await readFile(path.join(fixtureDir, "dos-lab.zip"));
manifest.push({
  file: "dos-lab.zip",
  url: "fixtures-src/dos-lab.asm",
  sha256: createHash("sha256").update(dosData).digest("hex"),
  bytes: dosData.length,
});
await writeFile(path.join(fixtureDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
