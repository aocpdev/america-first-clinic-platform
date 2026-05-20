import { rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const targets = [".next"];
const includeStaleCaches = process.argv.includes("--stale");

if (includeStaleCaches) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(".next-stale-build-cache")) {
      targets.push(entry.name);
    }
  }
}

for (const target of targets) {
  const path = join(root, target);
  try {
    rmSync(path, { recursive: true, force: true });
    console.log(`Removed ${target}`);
  } catch (error) {
    console.warn(`Could not remove ${target}:`, error instanceof Error ? error.message : error);
  }
}

if (!includeStaleCaches) {
  console.log("Skipped .next-stale-build-cache* folders. Run `npm run clean:next -- --stale` only when you want to purge old cache backups.");
}
