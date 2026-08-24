import { useEffect, useMemo, useState } from "react";

import { AuthPanel } from "./features/auth/AuthPanel.jsx";
import { createAuthApi } from "./features/auth/authState.js";
import { Calculator } from "./features/calculator/Calculator.jsx";
import { GamePanel } from "./features/game/GamePanel.jsx";
import { TodoPanel } from "./features/todos/TodoPanel.jsx";
import { createSupabaseClient } from "./lib/supabase/client.js";
import { createTodoRepository } from "./lib/supabase/todos.js";

export function App() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [session, setSession] = useState(null);
  const supabase = useMemo(() => globalThis.APP_SUPABASE_CLIENT ?? createSupabaseClient(), []);
  const authApi = useMemo(() => (supabase ? createAuthApi(supabase) : null), [supabase]);
  const todoRepository = useMemo(() => (
    supabase ? createTodoRepository(supabase, () => session?.user ?? null) : null
  ), [supabase, session]);

  useEffect(() => {
    if (!authApi) {
      return undefined;
    }

    let isCurrent = true;
    authApi.getSession()
      .then((nextSession) => {
        if (isCurrent) {
          setSession(nextSession);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSession(null);
        }
      });

    const subscription = supabase.auth.onAuthStateChange?.((_event, nextSession) => {
      setSession(nextSession?.access_token ? {
        accessToken: nextSession.access_token,
        user: {
          id: nextSession.user.id,
          email: nextSession.user.email,
        },
      } : null);
    });

    return () => {
      isCurrent = false;
      subscription?.data?.subscription?.unsubscribe?.();
    };
  }, [authApi, supabase]);

  return (
    <main className="app-shell" aria-label="Productivity app">
      <div className="workspace">
        <nav className="app-tabs" role="tablist" aria-label="App views">
          <button
            id="tab-calculator"
            className={`app-tab${activeTab === "calculator" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "calculator"}
            aria-controls="panel-calculator"
            tabIndex={activeTab === "calculator" ? 0 : -1}
            onClick={() => setActiveTab("calculator")}
          >
            Calculator
          </button>
          <button
            id="tab-todos"
            className={`app-tab${activeTab === "todos" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "todos"}
            aria-controls="panel-todos"
            tabIndex={activeTab === "todos" ? 0 : -1}
            onClick={() => setActiveTab("todos")}
          >
            Todo List
          </button>
          <button
            id="tab-game"
            className={`app-tab${activeTab === "game" ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "game"}
            aria-controls="panel-game"
            tabIndex={activeTab === "game" ? 0 : -1}
            onClick={() => setActiveTab("game")}
          >
            Game
          </button>
        </nav>
        <div hidden={activeTab !== "calculator"}>
          <Calculator />
        </div>
        <section
          id="panel-todos"
          className={`todo-panel app-panel${activeTab === "todos" ? " is-active" : ""}`}
          role="tabpanel"
          aria-labelledby="tab-todos"
          hidden={activeTab !== "todos"}
        >
          <header className="todo-panel__header">
            <div>
              <p className="eyebrow">Supabase Todo</p>
              <h1>Task List</h1>
            </div>
            <span className="status-pill">{session ? "Ready" : "Sign in"}</span>
          </header>
          <AuthPanel authApi={authApi} session={session} onSessionChange={setSession} />
          <TodoPanel repository={todoRepository} session={session} />
        </section>
        <div
          id="panel-game"
          role="tabpanel"
          aria-labelledby="tab-game"
          hidden={activeTab !== "game"}
        >
          <GamePanel />
        </div>
      </div>
    </main>
  );
}
