import {
  backspace,
  clear,
  createInitialState,
  deleteHistoryEntry,
  evaluate,
  inputDecimal,
  inputDigit,
  inputOperator,
} from "./calculator.js";
import { createTodoClient } from "./todoClient.js";

const calculatorPanel = document.querySelector("#panel-calculator");
const displayElement = document.querySelector("#display");
const expressionElement = document.querySelector("#expression");
const errorElement = document.querySelector("#error");
const historyElement = document.querySelector("#history");
const keys = document.querySelectorAll("[data-key]");
const tabs = document.querySelectorAll("[role='tab']");
const todoStatusElement = document.querySelector("#todo-status");
const todoForm = document.querySelector("#todo-form");
const todoTitleInput = document.querySelector("#todo-title");
const todoMessageElement = document.querySelector("#todo-message");
const todoListElement = document.querySelector("#todo-list");

let state = createInitialState();
const todoClient = createTodoClient(globalThis.APP_CONFIG ?? {});
const todoState = {
  editingId: null,
  error: "",
  isLoaded: false,
  isLoading: false,
  todos: [],
};

function render() {
  displayElement.value = state.display;
  displayElement.textContent = state.display;
  expressionElement.textContent = state.expression || "\u00a0";
  errorElement.textContent = state.error;

  historyElement.replaceChildren();

  if (state.history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "history-empty";
    emptyItem.textContent = "No calculations yet";
    historyElement.append(emptyItem);
    return;
  }

  state.history.forEach((entry, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    const deleteButton = document.createElement("button");

    text.className = "history-entry";
    text.textContent = entry;

    deleteButton.className = "history-delete";
    deleteButton.type = "button";
    deleteButton.dataset.historyIndex = String(index);
    deleteButton.setAttribute("aria-label", `Delete history item ${entry}`);
    deleteButton.title = "Delete history item";
    deleteButton.textContent = "x";

    item.append(text, deleteButton);
    historyElement.append(item);
  });
}

function renderTodos() {
  todoStatusElement.textContent = todoClient.isConfigured ? "Ready" : "Setup";
  todoTitleInput.disabled = !todoClient.isConfigured || todoState.isLoading;
  todoForm.querySelector("button").disabled = !todoClient.isConfigured || todoState.isLoading;
  todoMessageElement.classList.toggle("is-error", Boolean(todoState.error));

  if (!todoClient.isConfigured) {
    todoMessageElement.textContent = "Add Supabase config to config.js to load todos.";
  } else if (todoState.error) {
    todoMessageElement.textContent = todoState.error;
  } else if (todoState.isLoading) {
    todoMessageElement.textContent = "Loading todos...";
  } else {
    todoMessageElement.textContent = "Todos are stored in Supabase.";
  }

  todoListElement.replaceChildren();

  if (todoState.todos.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "todo-empty";
    emptyItem.textContent = "No tasks yet";
    todoListElement.append(emptyItem);
    return;
  }

  for (const todo of todoState.todos) {
    const item = document.createElement("li");

    if (todoState.editingId === todo.id) {
      const editRow = document.createElement("div");
      const editInput = document.createElement("input");
      const saveButton = document.createElement("button");

      editRow.className = "todo-edit-row";
      editInput.className = "todo-edit-input";
      editInput.type = "text";
      editInput.value = todo.title;
      editInput.maxLength = 120;
      editInput.setAttribute("aria-label", "Edit todo title");
      saveButton.className = "todo-action";
      saveButton.type = "button";
      saveButton.dataset.todoAction = "save";
      saveButton.dataset.todoId = todo.id;
      saveButton.textContent = "Save todo";

      editRow.append(editInput, saveButton);
      item.append(editRow);
      todoListElement.append(item);
      continue;
    }

    const checkbox = document.createElement("input");
    const title = document.createElement("span");
    const actions = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    checkbox.className = "todo-check";
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.dataset.todoAction = "toggle";
    checkbox.dataset.todoId = todo.id;
    checkbox.setAttribute("aria-label", `Mark ${todo.title} ${todo.completed ? "active" : "complete"}`);

    title.className = "todo-title";
    title.classList.toggle("is-complete", todo.completed);
    title.textContent = todo.title;

    actions.className = "todo-actions";
    editButton.className = "todo-action";
    editButton.type = "button";
    editButton.dataset.todoAction = "edit";
    editButton.dataset.todoId = todo.id;
    editButton.setAttribute("aria-label", `Edit ${todo.title}`);
    editButton.textContent = "Edit";

    deleteButton.className = "todo-action todo-action--danger";
    deleteButton.type = "button";
    deleteButton.dataset.todoAction = "delete";
    deleteButton.dataset.todoId = todo.id;
    deleteButton.setAttribute("aria-label", `Delete ${todo.title}`);
    deleteButton.textContent = "Delete";

    actions.append(editButton, deleteButton);
    item.append(checkbox, title, actions);
    todoListElement.append(item);
  }
}

function setActiveTab(tab) {
  for (const currentTab of tabs) {
    const isActive = currentTab === tab;
    const panel = document.querySelector(`#${currentTab.getAttribute("aria-controls")}`);

    currentTab.classList.toggle("is-active", isActive);
    currentTab.setAttribute("aria-selected", String(isActive));
    currentTab.tabIndex = isActive ? 0 : -1;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }

  tab.focus();

  if (tab.id === "tab-todos") {
    loadTodos();
  }
}

function moveTabFocus(event) {
  const currentIndex = Array.from(tabs).indexOf(event.target);
  let nextIndex = currentIndex;

  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  setActiveTab(tabs[nextIndex]);
}

function findTodo(id) {
  return todoState.todos.find((todo) => todo.id === id);
}

function replaceTodo(updatedTodo) {
  todoState.todos = todoState.todos.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo));
}

async function runTodoAction(action) {
  todoState.error = "";
  todoState.isLoading = true;
  renderTodos();

  try {
    await action();
  } catch (error) {
    todoState.error = error.message;
  } finally {
    todoState.isLoading = false;
    renderTodos();
  }
}

async function loadTodos() {
  if (!todoClient.isConfigured || todoState.isLoaded || todoState.isLoading) {
    renderTodos();
    return;
  }

  await runTodoAction(async () => {
    todoState.todos = await todoClient.listTodos();
    todoState.isLoaded = true;
  });
}

function dispatchKey(key) {
  if (/^\d$/.test(key)) {
    state = inputDigit(state, key);
  } else if (key === ".") {
    state = inputDecimal(state);
  } else if (["+", "-", "*", "/"].includes(key)) {
    state = inputOperator(state, key);
  } else if (key === "=" || key === "Enter") {
    state = evaluate(state);
  } else if (key === "clear" || key === "Escape") {
    state = clear(state);
  } else if (key === "delete" || key === "Backspace") {
    state = backspace(state);
  }

  render();
}

for (const key of keys) {
  key.addEventListener("click", () => dispatchKey(key.dataset.key));
}

for (const tab of tabs) {
  tab.addEventListener("click", () => setActiveTab(tab));
  tab.addEventListener("keydown", moveTabFocus);
}

historyElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-index]");

  if (!button) {
    return;
  }

  state = deleteHistoryEntry(state, Number.parseInt(button.dataset.historyIndex, 10));
  render();
});

document.addEventListener("keydown", (event) => {
  if (calculatorPanel.hidden) {
    return;
  }

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  const targetButton = event.target instanceof Element ? event.target.closest("button") : null;

  if (targetButton && ["Enter", " "].includes(event.key)) {
    return;
  }

  const supportedKeys = /^[0-9.]$/.test(event.key)
    || ["+", "-", "*", "/", "Enter", "Backspace", "Escape"].includes(event.key);

  if (!supportedKeys) {
    return;
  }

  event.preventDefault();
  dispatchKey(event.key);
});

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = todoTitleInput.value.trim();

  if (!title) {
    return;
  }

  runTodoAction(async () => {
    const todo = await todoClient.createTodo(title);
    todoState.todos = [todo, ...todoState.todos];
    todoTitleInput.value = "";
  });
});

todoListElement.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-todo-action='toggle']");

  if (!checkbox) {
    return;
  }

  const todo = findTodo(checkbox.dataset.todoId);

  if (!todo) {
    return;
  }

  const previousTodo = todo;
  replaceTodo({ ...todo, completed: checkbox.checked });
  todoState.error = "";

  todoClient.updateTodo(todo.id, { completed: checkbox.checked })
    .then((updatedTodo) => {
      replaceTodo(updatedTodo);
    })
    .catch((error) => {
      replaceTodo(previousTodo);
      todoState.error = error.message;
    })
    .finally(() => {
      renderTodos();
    });
});

todoListElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-todo-action]");

  if (!button) {
    return;
  }

  const todo = findTodo(button.dataset.todoId);

  if (!todo) {
    return;
  }

  if (button.dataset.todoAction === "edit") {
    todoState.editingId = todo.id;
    renderTodos();
    todoListElement.querySelector(".todo-edit-input")?.focus();
    return;
  }

  if (button.dataset.todoAction === "save") {
    const title = button.closest("li").querySelector(".todo-edit-input").value.trim();

    if (!title) {
      return;
    }

    runTodoAction(async () => {
      const updatedTodo = await todoClient.updateTodo(todo.id, { title });
      replaceTodo(updatedTodo);
      todoState.editingId = null;
    });
    return;
  }

  if (button.dataset.todoAction === "delete") {
    runTodoAction(async () => {
      await todoClient.deleteTodo(todo.id);
      todoState.todos = todoState.todos.filter((currentTodo) => currentTodo.id !== todo.id);
    });
  }
});

render();
renderTodos();
