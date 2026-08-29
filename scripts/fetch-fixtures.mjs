import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
];

await rm(fixtureDir, { recursive: true, force: true });
await mkdir(fixtureDir, { recursive: true });
for (const fixture of fixtures) {
  const response = await fetch(fixture.url, { redirect: "follow", headers: fixture.headers });
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

const ps1Fixture = {
  file: "ps1-lab.exe",
  url: "fixtures-src/ps1-lab/main.c",
  sha256: "74b1d679d7bae3860e9ef3756279705375c53d85bf47c4914dff08e01e38b687",
};
const ps1Data = await readFile(path.join(root, "fixtures-src", "ps1-lab", ps1Fixture.file));
const ps1Digest = createHash("sha256").update(ps1Data).digest("hex");
if (ps1Digest !== ps1Fixture.sha256) {
  throw new Error(`${ps1Fixture.file} checksum mismatch: expected ${ps1Fixture.sha256}, got ${ps1Digest}`);
}
await writeFile(path.join(fixtureDir, ps1Fixture.file), ps1Data);
manifest.push({ ...ps1Fixture, bytes: ps1Data.length });
console.log(`${ps1Fixture.file} ${ps1Digest}`);
await writeFile(path.join(fixtureDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
