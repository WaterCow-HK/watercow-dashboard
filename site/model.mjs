export const statuses = Object.freeze({
  Done: "已完成",
  "In Progress": "進行中",
  Ready: "可開始",
  Backlog: "待處理",
  Blocked: "受阻",
  Review: "審查中",
  Superseded: "已取代",
});
export const phases = Object.freeze([
  "規劃與開發基礎",
  "平台與安全基礎",
  "手動協作體驗",
  "安全資料擷取",
  "智慧助手",
  "營運與上線準備",
  "外部通訊渠道",
  "後續發展",
]);
export const owners = Object.freeze(["Eddie", "Gary", "共同負責"]);
export function validateSnapshot(data) {
  const exact = (value, keys) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === [...keys].sort().join(",");
  if (
    !exact(data, ["schemaVersion", "sourceCommit", "sourceDate", "tasks"]) ||
    data.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(data.sourceCommit) ||
    typeof data.sourceDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.sourceDate) ||
    !Number.isFinite(Date.parse(data.sourceDate)) ||
    !Array.isArray(data.tasks) ||
    data.tasks.length < 1 ||
    data.tasks.length > 500
  )
    throw new Error("Invalid snapshot");
  const ids = new Set();
  for (const task of data.tasks) {
    if (
      !exact(task, ["id", "title", "phase", "status", "owner"]) ||
      typeof task.id !== "string" ||
      !/^P[0-7]-\d{3}$/.test(task.id) ||
      ids.has(task.id) ||
      task.phase !== Number(task.id[1]) ||
      typeof task.title !== "string" ||
      task.title.length > 100 ||
      !/^[\p{Script=Han}、，（）與及\s]+$/u.test(task.title) ||
      !Object.hasOwn(statuses, task.status) ||
      !owners.includes(task.owner)
    )
      throw new Error("Invalid task");
    ids.add(task.id);
  }
  return data;
}
export function filterTasks(
  tasks,
  { query = "", phase = "", status = "", owner = "" } = {},
) {
  const term = query.trim().toLocaleLowerCase("zh-Hant");
  return tasks.filter(
    (task) =>
      (!term ||
        `${task.id} ${task.title} ${task.owner}`
          .toLocaleLowerCase("zh-Hant")
          .includes(term)) &&
      (phase === "" || task.phase === Number(phase)) &&
      (!status || task.status === status) &&
      (!owner || task.owner === owner),
  );
}
export function progress(tasks) {
  const active = tasks.filter((task) => task.status !== "Superseded");
  const done = active.filter((task) => task.status === "Done").length;
  return {
    done,
    total: active.length,
    percent: active.length ? Math.round((done / active.length) * 100) : 0,
  };
}
