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

const displayElement = document.querySelector("#display");
const expressionElement = document.querySelector("#expression");
const errorElement = document.querySelector("#error");
const historyElement = document.querySelector("#history");
const keys = document.querySelectorAll("[data-key]");

let state = createInitialState();

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

historyElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-index]");

  if (!button) {
    return;
  }

  state = deleteHistoryEntry(state, Number.parseInt(button.dataset.historyIndex, 10));
  render();
});

document.addEventListener("keydown", (event) => {
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

render();
