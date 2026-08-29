import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "public", "fixtures");
const fixtures = [
  ["happyflappy.prg", "https://raw.githubusercontent.com/retrobrews/c64-games/master/happyflappy.prg", "bb269e813f0fc648c643b0fc3bbbc9e47a2e342ce144ff73191d1ee3068ed41e"],
  ["flappy_the_duck.bin", "https://raw.githubusercontent.com/retrobrews/atari2600-games/master/flappy_the_duck.bin", "e6b0e6db04d459a12e3202d695ce015fe8f84a0e67f7d26c87cc086ab500cab0"],
  ["blt.sfc", "https://raw.githubusercontent.com/retrobrews/snes-games/master/blt.sfc", "1f4004deb5981fa6115c1d3676add48d5437a3edb52a9203fbe14085fcb0b7ac"],
  ["megaflappysis.bin", "https://raw.githubusercontent.com/retrobrews/md-games/master/megaflappysis.bin", "7e428be1f4a337abd86ab35db9b10c755efb14aad7f62f701369481dd2d6357f"],
  ["circus.zip", "https://www.mamedev.org/roms/circus/circus.zip", "27d3952dba171d50ef63a7a651e063f83830d2e07e4799dadcc5c42e0371d424"],
];

await mkdir(fixtureDir, { recursive: true });
let manifest = [];
try { manifest = JSON.parse(await readFile(path.join(fixtureDir, "manifest.json"), "utf8")); } catch {}

for (const [file, url, expected] of fixtures) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (sha256 !== expected) throw new Error(`${file} checksum mismatch: expected ${expected}, got ${sha256}`);
  await writeFile(path.join(fixtureDir, file), data);
  manifest = manifest.filter((item) => item.file !== file);
  manifest.push({ file, url, sha256, bytes: data.length, distribution: "local-test-only" });
  console.log(`${file} ${sha256}`);
}

await writeFile(path.join(fixtureDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
