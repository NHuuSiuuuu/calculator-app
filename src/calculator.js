const MAX_HISTORY = 5;

export function createInitialState() {
  return {
    display: "0",
    expression: "",
    previousValue: null,
    operator: null,
    waitingForOperand: false,
    error: "",
    history: [],
  };
}

export function calculate(left, operator, right) {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) {
        throw new Error("Cannot divide by zero");
      }
      return left / right;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

export function inputDigit(state, digit) {
  if (!/^\d$/.test(digit)) {
    return state;
  }

  if (state.error) {
    state = createInitialState();
  }

  if (state.waitingForOperand) {
    return { ...state, display: digit, waitingForOperand: false, error: "" };
  }

  return {
    ...state,
    display: state.display === "0" ? digit : `${state.display}${digit}`,
    error: "",
  };
}

export function inputDecimal(state) {
  if (state.error) {
    state = createInitialState();
  }

  if (state.waitingForOperand) {
    return { ...state, display: "0.", waitingForOperand: false, error: "" };
  }

  if (state.display.includes(".")) {
    return state;
  }

  return { ...state, display: `${state.display}.`, error: "" };
}

export function inputOperator(state, operator) {
  if (!["+", "-", "*", "/"].includes(operator)) {
    return state;
  }

  if (state.error) {
    return state;
  }

  const currentValue = Number.parseFloat(state.display);

  if (state.operator && !state.waitingForOperand) {
    const evaluated = evaluate(state);
    if (evaluated.error) {
      return evaluated;
    }

    return {
      ...evaluated,
      previousValue: Number.parseFloat(evaluated.display),
      operator,
      expression: `${formatNumber(Number.parseFloat(evaluated.display))} ${operator}`,
      waitingForOperand: true,
    };
  }

  return {
    ...state,
    previousValue: currentValue,
    operator,
    expression: `${formatNumber(currentValue)} ${operator}`,
    waitingForOperand: true,
    error: "",
  };
}

export function evaluate(state) {
  if (!state.operator || state.previousValue === null || state.waitingForOperand) {
    return state;
  }

  const rightValue = Number.parseFloat(state.display);

  try {
    const result = calculate(state.previousValue, state.operator, rightValue);
    const expression = `${formatNumber(state.previousValue)} ${state.operator} ${formatNumber(rightValue)}`;
    const display = formatNumber(result);
    const entry = `${expression} = ${display}`;

    return {
      ...state,
      display,
      expression,
      previousValue: null,
      operator: null,
      waitingForOperand: true,
      error: "",
      history: [entry, ...state.history].slice(0, MAX_HISTORY),
    };
  } catch (error) {
    return {
      ...state,
      error: error.message,
      previousValue: null,
      operator: null,
      waitingForOperand: true,
    };
  }
}

export function backspace(state) {
  if (state.error || state.waitingForOperand) {
    return {
      ...state,
      display: "0",
      expression: "",
      previousValue: null,
      operator: null,
      error: "",
      waitingForOperand: false,
    };
  }

  return {
    ...state,
    display: state.display.length > 1 ? state.display.slice(0, -1) : "0",
  };
}

export function clear() {
  return createInitialState();
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.parseFloat(value.toFixed(10)).toString();
}
