import { useEffect, useState } from "react";

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

const keys = [
  { label: "C", value: "clear", className: "key key--utility" },
  { label: "Del", value: "delete", className: "key key--utility" },
  { label: "/", value: "/", className: "key key--operator" },
  { label: "*", value: "*", className: "key key--operator" },
  { label: "7", value: "7", className: "key" },
  { label: "8", value: "8", className: "key" },
  { label: "9", value: "9", className: "key" },
  { label: "-", value: "-", className: "key key--operator" },
  { label: "4", value: "4", className: "key" },
  { label: "5", value: "5", className: "key" },
  { label: "6", value: "6", className: "key" },
  { label: "+", value: "+", className: "key key--operator" },
  { label: "1", value: "1", className: "key" },
  { label: "2", value: "2", className: "key" },
  { label: "3", value: "3", className: "key" },
  { label: "=", value: "=", className: "key key--equals" },
  { label: "0", value: "0", className: "key key--zero" },
  { label: ".", value: ".", className: "key" },
];

function reduceKey(state, key) {
  if (/^\d$/.test(key)) {
    return inputDigit(state, key);
  }

  if (key === ".") {
    return inputDecimal(state);
  }

  if (["+", "-", "*", "/"].includes(key)) {
    return inputOperator(state, key);
  }

  if (key === "=" || key === "Enter") {
    return evaluate(state);
  }

  if (key === "clear" || key === "Escape") {
    return clear(state);
  }

  if (key === "delete" || key === "Backspace") {
    return backspace(state);
  }

  return state;
}

export function Calculator() {
  const [state, setState] = useState(() => createInitialState());

  function dispatchKey(key) {
    setState((currentState) => reduceKey(currentState, key));
  }

  useEffect(() => {
    function handleKeyDown(event) {
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
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section id="panel-calculator" className="calculator app-panel is-active" role="tabpanel" aria-labelledby="tab-calculator">
      <header className="calculator__header">
        <div>
          <p className="eyebrow">Basic Calculator</p>
          <h1>Arithmetic Desk</h1>
        </div>
        <span className="status-pill">Ready</span>
      </header>

      <section className="display-panel" aria-live="polite">
        <div id="expression" className="expression" aria-label="Expression">{state.expression || "\u00a0"}</div>
        <output id="display" className="display" aria-label="Current value">{state.display}</output>
        <div id="error" className="error" role="alert">{state.error}</div>
      </section>

      <section className="keypad" aria-label="Calculator keypad">
        {keys.map((key) => (
          <button
            key={key.value}
            type="button"
            className={key.className}
            data-key={key.value}
            onClick={() => dispatchKey(key.value)}
          >
            {key.label}
          </button>
        ))}
      </section>

      <section className="history-panel" aria-label="Calculation history">
        <h2>History</h2>
        <ol id="history" className="history-list">
          {state.history.length === 0 ? (
            <li className="history-empty">No calculations yet</li>
          ) : (
            state.history.map((entry, index) => (
              <li key={`${entry}-${index}`}>
                <span className="history-entry">{entry}</span>
                <button
                  className="history-delete"
                  type="button"
                  aria-label={`Delete history item ${entry}`}
                  title="Delete history item"
                  onClick={() => setState((currentState) => deleteHistoryEntry(currentState, index))}
                >
                  x
                </button>
              </li>
            ))
          )}
        </ol>
      </section>
    </section>
  );
}
