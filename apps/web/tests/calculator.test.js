import assert from "node:assert/strict";
import test from "node:test";

import {
  calculate,
  createInitialState,
  inputDigit,
  inputOperator,
  inputDecimal,
  evaluate,
  clear,
  backspace,
  deleteHistoryEntry,
} from "../src/features/calculator/calculator.js";

test("calculate handles addition, subtraction, multiplication, and division", () => {
  assert.equal(calculate(7, "+", 5), 12);
  assert.equal(calculate(7, "-", 5), 2);
  assert.equal(calculate(7, "*", 5), 35);
  assert.equal(calculate(10, "/", 2), 5);
});

test("calculate rejects division by zero", () => {
  assert.throws(() => calculate(10, "/", 0), /Cannot divide by zero/);
});

test("input flow evaluates a chained arithmetic expression", () => {
  let state = createInitialState();

  state = inputDigit(state, "1");
  state = inputDigit(state, "2");
  state = inputOperator(state, "+");
  state = inputDigit(state, "3");
  state = evaluate(state);
  state = inputOperator(state, "*");
  state = inputDigit(state, "4");
  state = evaluate(state);

  assert.equal(state.display, "60");
  assert.equal(state.expression, "15 * 4");
  assert.deepEqual(state.history.slice(0, 2), ["15 * 4 = 60", "12 + 3 = 15"]);
});

test("decimal input is limited to one decimal point per number", () => {
  let state = createInitialState();

  state = inputDigit(state, "4");
  state = inputDecimal(state);
  state = inputDigit(state, "5");
  state = inputDecimal(state);

  assert.equal(state.display, "4.5");
});

test("clear and backspace update the current value predictably", () => {
  let state = createInitialState();

  state = inputDigit(state, "9");
  state = inputDigit(state, "8");
  state = backspace(state);
  assert.equal(state.display, "9");

  state = clear(state);
  assert.deepEqual(state, createInitialState());
});

test("backspace clears division-by-zero errors without leaving a stale expression", () => {
  let state = createInitialState();

  state = inputDigit(state, "8");
  state = inputOperator(state, "/");
  state = inputDigit(state, "0");
  state = evaluate(state);
  state = backspace(state);

  assert.equal(state.display, "0");
  assert.equal(state.error, "");
  assert.equal(state.expression, "");
  assert.equal(state.previousValue, null);
  assert.equal(state.operator, null);
});

test("deleteHistoryEntry removes a single history item by index", () => {
  const state = {
    ...createInitialState(),
    history: ["4 * 5 = 20", "12 + 3 = 15", "10 - 7 = 3"],
  };

  const updated = deleteHistoryEntry(state, 1);

  assert.deepEqual(updated.history, ["4 * 5 = 20", "10 - 7 = 3"]);
  assert.deepEqual(state.history, ["4 * 5 = 20", "12 + 3 = 15", "10 - 7 = 3"]);
});
