const categories = {
  week: "This week",
  month: "This month",
  general: "General",
  aspirational: "Aspirational",
};

const storageKey = "minimal-todo-state-v1";
const defaultState = Object.fromEntries(
  Object.keys(categories).map((key) => [key, { tasks: [], notes: "" }]),
);

let activeCategory = "week";
let state = loadState();
let saveTimer;

const dateLine = document.querySelector("#dateLine");
const tabs = document.querySelectorAll(".tab");
const taskForm = document.querySelector("#taskForm");
const taskInput = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");
const taskTemplate = document.querySelector("#taskTemplate");
const emptyState = document.querySelector("#emptyState");
const categoryTitle = document.querySelector("#categoryTitle");
const notesTitle = document.querySelector("#notesTitle");
const notesInput = document.querySelector("#notesInput");
const saveState = document.querySelector("#saveState");
const saveNotes = document.querySelector("#saveNotes");
const exportData = document.querySelector("#exportData");
const importData = document.querySelector("#importData");
const importFile = document.querySelector("#importFile");
const backupStatus = document.querySelector("#backupStatus");

dateLine.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeCategory = tab.dataset.category;
    render();
  });
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const label = taskInput.value.trim();

  if (!label) {
    taskInput.focus();
    return;
  }

  state[activeCategory].tasks.unshift({
    id: makeId(),
    label,
    createdAt: Date.now(),
  });

  taskInput.value = "";
  persist();
  render();
});

notesInput.addEventListener("input", () => {
  state[activeCategory].notes = notesInput.value;
  setSaveStatus("Saving");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persist();
    setSaveStatus("Saved");
  }, 250);
});

saveNotes.addEventListener("click", () => {
  state[activeCategory].notes = notesInput.value;
  persist();
  setSaveStatus("Saved");
});

exportData.addEventListener("click", () => {
  const backup = {
    app: "minimal-todo",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories,
    state,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `to-do-backup-${formatBackupDate(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setBackupStatus("Backup exported");
});

importData.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const [file] = importFile.files;

  if (!file) {
    return;
  }

  try {
    const imported = JSON.parse(await file.text());
    state = normalizeImportedState(imported);
    persist();
    render();
    setBackupStatus("Backup imported");
  } catch {
    setBackupStatus("Could not import that file");
  } finally {
    importFile.value = "";
  }
});

function render() {
  const current = state[activeCategory];
  categoryTitle.textContent = categories[activeCategory];
  notesTitle.textContent = `${categories[activeCategory]} notes`;
  notesInput.value = current.notes;

  tabs.forEach((tab) => {
    const key = tab.dataset.category;
    tab.classList.toggle("is-active", key === activeCategory);
    tab.setAttribute("aria-current", key === activeCategory ? "page" : "false");
    document.querySelector(`#count-${key}`).textContent = state[key].tasks.length;
  });

  taskList.replaceChildren();
  current.tasks.forEach((task) => {
    const node = taskTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector("input");
    const label = node.querySelector("span");

    label.textContent = task.label;
    checkbox.addEventListener("change", () => completeTask(task.id, node));
    taskList.append(node);
  });

  emptyState.classList.toggle("is-visible", current.tasks.length === 0);
  setSaveStatus("Saved");
}

function completeTask(taskId, node) {
  node.classList.add("is-removing");
  window.setTimeout(() => {
    state[activeCategory].tasks = state[activeCategory].tasks.filter(
      (task) => task.id !== taskId,
    );
    persist();
    render();
  }, 180);
}

function setSaveStatus(message) {
  saveState.textContent = message;
  saveState.classList.toggle("is-saving", message === "Saving");
  saveState.classList.toggle("is-saved", message === "Saved");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Object.fromEntries(
      Object.keys(categories).map((key) => [
        key,
        {
          tasks: Array.isArray(saved?.[key]?.tasks) ? saved[key].tasks : [],
          notes: typeof saved?.[key]?.notes === "string" ? saved[key].notes : "",
        },
      ]),
    );
  } catch {
    return cloneDefaultState();
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function normalizeImportedState(imported) {
  const source = imported?.state ?? imported;

  if (!source || typeof source !== "object") {
    throw new Error("Invalid backup");
  }

  return Object.fromEntries(
    Object.keys(categories).map((key) => [
      key,
      {
        tasks: normalizeTasks(source[key]?.tasks),
        notes: typeof source[key]?.notes === "string" ? source[key].notes : "",
      },
    ]),
  );
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .filter((task) => typeof task?.label === "string" && task.label.trim())
    .map((task) => ({
      id: typeof task.id === "string" ? task.id : makeId(),
      label: task.label.trim().slice(0, 120),
      createdAt: Number.isFinite(task.createdAt) ? task.createdAt : Date.now(),
    }));
}

function formatBackupDate(date) {
  return date.toISOString().slice(0, 10);
}

function setBackupStatus(message) {
  backupStatus.textContent = message;
  window.clearTimeout(setBackupStatus.timer);
  setBackupStatus.timer = window.setTimeout(() => {
    backupStatus.textContent = "Saved on this device";
  }, 2600);
}

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneDefaultState() {
  return Object.fromEntries(
    Object.entries(defaultState).map(([key, value]) => [
      key,
      { tasks: [...value.tasks], notes: value.notes },
    ]),
  );
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      setBackupStatus("Offline install unavailable");
    });
  });
}
