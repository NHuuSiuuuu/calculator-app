import {
  backspace,
  clear,
  createInitialState,
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

  for (const entry of state.history) {
    const item = document.createElement("li");
    item.textContent = entry;
    historyElement.append(item);
  }
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

document.addEventListener("keydown", (event) => {
  const supportedKeys = /^[0-9.]$/.test(event.key)
    || ["+", "-", "*", "/", "Enter", "Backspace", "Escape"].includes(event.key);

  if (!supportedKeys) {
    return;
  }

  event.preventDefault();
  dispatchKey(event.key);
});

render();
