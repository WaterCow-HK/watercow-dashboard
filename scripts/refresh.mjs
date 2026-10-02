// Local-only export. Never run with private source credentials in public CI.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSnapshot } from "../site/model.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
export function exportTasks(markdown, catalog) {
  const section = markdown.split("## Backlog index\n")[1]?.split("\n## ")[0];
  if (!section) throw new Error("Missing task index");
  const tasks = [];
  const seen = new Set();
  for (const line of section.split("\n")) {
    if (!/^\| P\d-/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 7) throw new Error("Task index format changed");
    const [id, , status, , primary] = cells;
    // Deliberately omit subtasks and historical maintenance detail.
    if (!/^P[0-7]-\d{3}$/.test(id)) continue;
    if (seen.has(id) || !Object.hasOwn(catalog, id))
      throw new Error("Duplicate or untranslated task");
    seen.add(id);
    const owner = /Joint|Human|Eddie.*(?:DHMO|Gary)/.test(primary)
      ? "共同負責"
      : primary === "DHMO"
        ? "Gary"
        : /^Eddie(?:\s|;|$)/.test(primary)
          ? "Eddie"
          : null;
    if (!owner) throw new Error("Unrecognized owner");
    tasks.push({ id, title: catalog[id], phase: Number(id[1]), status, owner });
  }
  if (seen.size !== Object.keys(catalog).length)
    throw new Error("Translation catalogue differs from task index");
  return tasks;
}
export function refresh(source) {
  const git = (...args) =>
    execFileSync("git", ["-C", source, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  if (
    git("status", "--porcelain") ||
    git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")
  )
    throw new Error("Source must be clean and match fetched origin/main");
  if (
    git("remote", "get-url", "origin") !==
    "https://github.com/WaterCow-HK/watercow_travel_app.git"
  )
    throw new Error("Unexpected source repository");
  const catalog = JSON.parse(
    readFileSync(resolve(root, "catalog.json"), "utf8"),
  );
  const data = validateSnapshot({
    schemaVersion: 1,
    sourceCommit: git("rev-parse", "HEAD"),
    sourceDate: new Date(git("show", "-s", "--format=%cI", "HEAD"))
      .toISOString()
      .replace(".000Z", "Z"),
    tasks: exportTasks(
      git("show", "HEAD:docs/implementation/TASKS.md"),
      catalog,
    ),
  });
  writeFileSync(
    resolve(root, "site/tasks.json"),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  console.log(
    `Exported ${data.tasks.length} top-level task summaries. Review the diff before publication.`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: npm run refresh -- <private-source-checkout>");
    refresh(resolve(process.argv[2]));
  } catch {
    console.error(
      "Export failed. Check clean source, origin/main, catalogue and schema; no source contents logged.",
    );
    process.exitCode = 1;
  }
}
