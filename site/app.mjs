import {
  statuses,
  phases,
  owners,
  validateSnapshot,
  filterTasks,
  progress,
} from "./model.mjs";
const $ = (id) => document.getElementById(id);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function option(value, label) {
  const node = element("option", label);
  node.value = value;
  return node;
}
async function start() {
  const response = await fetch("./tasks.json", {
    cache: "no-cache",
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Unavailable");
  const data = validateSnapshot(await response.json());
  const date = new Intl.DateTimeFormat("zh-Hant-HK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(data.sourceDate));
  $("updated").textContent =
    `資料來源版本：${date}（香港時間） · ${data.sourceCommit.slice(0, 7)}`;
  const age = (Date.now() - Date.parse(data.sourceDate)) / 86400000;
  $("notice").textContent =
    age > 7
      ? "這份資料快照已超過七天，最新進度可能尚未反映。"
      : "目前顯示正式記錄的資料快照；不代表即時工作狀態。";
  const stats = progress(data.tasks);
  const totalCard = element("div", undefined, "stat total");
  totalCard.append(
    element("span", "整體任務完成"),
    element("strong", `${stats.percent}%`),
    element("small", `${stats.done} / ${stats.total} 項有效任務`),
  );
  $("summary").append(totalCard);
  for (const [key, label] of Object.entries(statuses)) {
    const card = element("div", undefined, "stat");
    card.append(
      element("span", label),
      element(
        "strong",
        String(data.tasks.filter((task) => task.status === key).length),
      ),
    );
    $("summary").append(card);
    $("status").append(option(key, label));
  }
  phases.forEach((name, phase) => {
    $("phase").append(option(String(phase), `第 ${phase} 階段 · ${name}`));
    const stats = progress(data.tasks.filter((task) => task.phase === phase));
    const card = element("article", undefined, "phase-card");
    const bar = element("progress");
    bar.max = Math.max(stats.total, 1);
    bar.value = stats.done;
    bar.setAttribute(
      "aria-label",
      `第 ${phase} 階段任務完成 ${stats.done} / ${stats.total}`,
    );
    card.append(
      element("small", `第 ${phase} 階段`),
      element("h3", name),
      bar,
      element("p", `${stats.done} / ${stats.total} 項任務 · ${stats.percent}%`),
    );
    $("phases").append(card);
  });
  owners.forEach((owner) => $("owner").append(option(owner, owner)));
  function render() {
    const tasks = filterTasks(
      data.tasks,
      Object.fromEntries(
        ["query", "phase", "status", "owner"].map((id) => [id, $(id).value]),
      ),
    );
    const fragment = document.createDocumentFragment();
    for (const task of tasks) {
      const row = element("li", undefined, "task");
      const title = element("div", undefined, "task-title");
      title.append(
        element("span", task.id, "task-id"),
        element("h3", task.title),
      );
      const details = element("div", undefined, "task-details");
      details.append(
        element("span", `第 ${task.phase} 階段`),
        element("span", task.owner),
        element(
          "span",
          statuses[task.status],
          `badge ${task.status.replaceAll(" ", "-")}`,
        ),
      );
      row.append(title, details);
      fragment.append(row);
    }
    $("list").replaceChildren(fragment);
    $("count").textContent = `顯示 ${tasks.length} / ${data.tasks.length} 項`;
    $("empty").hidden = tasks.length !== 0;
  }
  for (const id of ["query", "phase", "status", "owner"])
    $(id).addEventListener(id === "query" ? "input" : "change", render);
  $("reset").addEventListener("click", () => {
    for (const id of ["query", "phase", "status", "owner"]) $(id).value = "";
    render();
    $("query").focus();
  });
  render();
  $("dashboard").hidden = false;
}
start().catch(() => {
  $("dashboard").hidden = true;
  $("updated").textContent = "資料版本暫時無法讀取";
  $("notice").textContent =
    "無法載入任務資料，請稍後重新整理。未載入資料不代表任務數量為零。";
});
