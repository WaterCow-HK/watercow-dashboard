import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { validateSnapshot } from "../site/model.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
validateSnapshot(
  JSON.parse(readFileSync(resolve(root, "site/tasks.json"), "utf8")),
);
const output = resolve(root, "dist");
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
// Only these six files can enter the public Pages artifact.
for (const name of [
  "index.html",
  "style.css",
  "app.mjs",
  "model.mjs",
  "tasks.json",
  "favicon.svg",
]) {
  writeFileSync(
    resolve(output, name),
    readFileSync(resolve(root, "site", name)),
  );
}
console.log("Built six allowlisted static files.");
