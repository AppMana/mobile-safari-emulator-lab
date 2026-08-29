import { cp, mkdir, readdir, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "vendor", "emulatorjs", "data");
const coreOutput = path.join(output, "cores");
const packages = [
  "vice_x64sc", "stella2014", "fceumm", "snes9x", "genesis_plus_gx",
  "mgba", "mame2003_plus", "dosbox_pure", "pcsx_rearmed",
];

await rm(path.join(root, "public", "vendor"), { recursive: true, force: true });
await mkdir(coreOutput, { recursive: true });
await cp(path.join(root, "node_modules", "@emulatorjs", "emulatorjs", "data"), output, {
  recursive: true,
  filter: (source) => !source.includes(`${path.sep}cores${path.sep}`),
});

for (const name of packages) {
  const source = path.join(root, "node_modules", "@emulatorjs", `core-${name}`);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".data")) {
      await copyFile(path.join(source, entry.name), path.join(coreOutput, entry.name));
    }
  }
  await mkdir(path.join(coreOutput, "reports"), { recursive: true });
  await copyFile(path.join(source, "reports", `${name}.json`), path.join(coreOutput, "reports", `${name}.json`));
}

await copyFile(
  path.join(root, "node_modules", "coi-serviceworker", "coi-serviceworker.min.js"),
  path.join(root, "public", "coi-serviceworker.js"),
);

console.log(`Staged EmulatorJS 4.2.3 and ${packages.length} cores.`);
