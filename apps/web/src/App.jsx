import { Calculator } from "./features/calculator/Calculator.jsx";

export function App() {
  return (
    <main className="app-shell" aria-label="Productivity app">
      <div className="workspace">
        <nav className="app-tabs" role="tablist" aria-label="App views">
          <button id="tab-calculator" className="app-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="panel-calculator" tabIndex="0">
            Calculator
          </button>
          <button id="tab-todos" className="app-tab" type="button" role="tab" aria-selected="false" aria-controls="panel-todos" tabIndex="-1">
            Todo List
          </button>
        </nav>
        <Calculator />
        <section id="panel-todos" className="todo-panel app-panel" role="tabpanel" aria-labelledby="tab-todos" hidden>
          <header className="todo-panel__header">
            <div>
              <p className="eyebrow">Supabase Todo</p>
              <h1>Task List</h1>
            </div>
            <span className="status-pill">Setup</span>
          </header>
        </section>
      </div>
    </main>
  );
}
