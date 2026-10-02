import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateSnapshot,
  filterTasks,
  progress,
  statuses,
} from "../site/model.mjs";
import { exportTasks } from "../scripts/refresh.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const data = JSON.parse(
  readFileSync(new URL("../site/tasks.json", import.meta.url), "utf8"),
);
const copy = () => structuredClone(data);
const fixture = (id = "P1-001", status = "Ready", owner = "Eddie") =>
  `## Backlog index\n| ${id} | private title | ${status} | High | ${owner} | private agent | private evidence |\n\n## Details\nSECRET_CANARY`;
test("snapshot has a strict allowlist and all catalogue translations", () => {
  assert.equal(validateSnapshot(data), data);
  const catalog = JSON.parse(
    readFileSync(new URL("../catalog.json", import.meta.url)),
  );
  assert.equal(data.tasks.length, Object.keys(catalog).length);
  for (const task of data.tasks) assert.equal(task.title, catalog[task.id]);
});
test("rejects extra fields, duplicates, unknown status/phase/owner and non-Chinese HTML", () => {
  for (const mutate of [
    (d) => (d.secret = "x"),
    (d) => d.tasks.push(d.tasks[0]),
    (d) => (d.tasks[0].secret = "x"),
    (d) => (d.tasks[0].status = "Unknown"),
    (d) => (d.tasks[0].status = "constructor"),
    (d) => (d.tasks[0].owner = "unknown"),
    (d) => (d.tasks[0].phase = 8),
    (d) => (d.tasks[0].title = "<img src=x>"),
    (d) => (d.tasks[0].title = "English"),
    (d) => (d.sourceCommit = "bad"),
    (d) => (d.sourceDate = "yesterday"),
    (d) => (d.tasks = []),
  ]) {
    const value = copy();
    mutate(value);
    assert.throws(() => validateSnapshot(value));
  }
});
test("exports only curated fields; private content never leaves source", () => {
  const tasks = exportTasks(fixture(), { "P1-001": "帳戶驗證" });
  assert.deepEqual(tasks, [
    {
      id: "P1-001",
      title: "帳戶驗證",
      phase: 1,
      status: "Ready",
      owner: "Eddie",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(tasks), /private|SECRET_CANARY/);
});
test("export fails closed on missing, duplicate, untranslated and malformed task tables", () => {
  const catalog = { "P1-001": "帳戶驗證" };
  assert.throws(() => exportTasks("", catalog));
  assert.throws(() => exportTasks(fixture("P1-002"), catalog));
  assert.throws(() =>
    exportTasks(fixture(), { ...catalog, "P1-002": "租戶隔離" }),
  );
  assert.throws(() =>
    exportTasks(
      fixture().replace(
        "\n\n## Details",
        "\n| P1-001 | x | Ready | High | Eddie | x | x |\n\n## Details",
      ),
      catalog,
    ),
  );
  assert.throws(() =>
    exportTasks(
      fixture().replace(" | private agent", " | extra | private agent"),
      catalog,
    ),
  );
  assert.throws(() =>
    exportTasks(fixture("P1-001", "Ready", "unexpected"), catalog),
  );
});
test("search and filters intersect correctly, including empty results and phase zero", () => {
  assert.equal(filterTasks(data.tasks).length, data.tasks.length);
  assert.deepEqual(filterTasks(data.tasks, { query: " p1-001 " }), [
    data.tasks.find((t) => t.id === "P1-001"),
  ]);
  assert.ok(
    filterTasks(data.tasks, { phase: "0" }).every((t) => t.phase === 0),
  );
  assert.equal(filterTasks(data.tasks, { query: "<script>" }).length, 0);
  const result = filterTasks(data.tasks, {
    phase: "1",
    status: "Done",
    owner: "Eddie",
  });
  assert.ok(result.length > 0);
  assert.ok(
    result.every(
      (t) => t.phase === 1 && t.status === "Done" && t.owner === "Eddie",
    ),
  );
});
test("completion excludes superseded and never counts ready as done", () => {
  assert.deepEqual(
    progress([
      { status: "Done" },
      { status: "Ready" },
      { status: "Superseded" },
    ]),
    { done: 1, total: 2, percent: 50 },
  );
  assert.deepEqual(progress([]), { done: 0, total: 0, percent: 0 });
  assert.equal(Object.keys(statuses).length, 7);
});
test("site is Traditional Chinese with no remote scripts, unsafe HTML sinks or private links", () => {
  const html = readFileSync(
    new URL("../site/index.html", import.meta.url),
    "utf8",
  );
  const js = readFileSync(new URL("../site/app.mjs", import.meta.url), "utf8");
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /不代表整個功能、階段或產品已可上線/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(
    js,
    /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/,
  );
  for (const name of readdirSync(new URL("../site/", import.meta.url))) {
    const text = readFileSync(
      new URL(`../site/${name}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      text,
      /watercow_travel_app|supabase\.co|sb_secret_|service_role|postgres(?:ql)?:\/\//,
    );
  }
});
test("build artifact includes only six approved files and preserves valid data", () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root });
  assert.deepEqual(readdirSync(new URL("../dist/", import.meta.url)).sort(), [
    "app.mjs",
    "favicon.svg",
    "index.html",
    "model.mjs",
    "style.css",
    "tasks.json",
  ]);
  validateSnapshot(
    JSON.parse(readFileSync(new URL("../dist/tasks.json", import.meta.url))),
  );
});
