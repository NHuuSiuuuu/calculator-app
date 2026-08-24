import { useEffect, useState } from "react";

export function TodoPanel({ repository, session }) {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function runTodoAction(action) {
    setError("");
    setIsLoading(true);

    try {
      await action();
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session || !repository) {
      setTodos([]);
      return;
    }

    let isCurrent = true;
    runTodoAction(async () => {
      const nextTodos = await repository.listTodos();
      if (isCurrent) {
        setTodos(nextTodos);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [repository, session]);

  if (!session) {
    return null;
  }

  async function addTodo(event) {
    event.preventDefault();
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    await runTodoAction(async () => {
      const todo = await repository.createTodo(nextTitle);
      setTodos((currentTodos) => [todo, ...currentTodos]);
      setTitle("");
    });
  }

  async function toggleTodo(todo, completed) {
    const previousTodos = todos;
    setTodos((currentTodos) => currentTodos.map((currentTodo) => (
      currentTodo.id === todo.id ? { ...currentTodo, completed } : currentTodo
    )));

    try {
      const updatedTodo = await repository.updateTodo(todo.id, { completed });
      setTodos((currentTodos) => currentTodos.map((currentTodo) => (
        currentTodo.id === updatedTodo.id ? updatedTodo : currentTodo
      )));
    } catch (currentError) {
      setTodos(previousTodos);
      setError(currentError.message);
    }
  }

  async function saveTodo(todo) {
    const nextTitle = editingTitle.trim();

    if (!nextTitle) {
      return;
    }

    await runTodoAction(async () => {
      const updatedTodo = await repository.updateTodo(todo.id, { title: nextTitle });
      setTodos((currentTodos) => currentTodos.map((currentTodo) => (
        currentTodo.id === updatedTodo.id ? updatedTodo : currentTodo
      )));
      setEditingId(null);
      setEditingTitle("");
    });
  }

  async function deleteTodo(todo) {
    await runTodoAction(async () => {
      await repository.deleteTodo(todo.id);
      setTodos((currentTodos) => currentTodos.filter((currentTodo) => currentTodo.id !== todo.id));
    });
  }

  return (
    <>
      <form id="todo-form" className="todo-form" onSubmit={addTodo}>
        <label className="todo-label" htmlFor="todo-title">New todo</label>
        <div className="todo-compose">
          <input
            id="todo-title"
            className="todo-input"
            name="title"
            type="text"
            autoComplete="off"
            maxLength="120"
            placeholder="Add a task"
            value={title}
            disabled={isLoading}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="todo-add" type="submit" disabled={isLoading}>Add todo</button>
        </div>
      </form>

      <p id="todo-message" className={`todo-message${error ? " is-error" : ""}`} role="status">
        {error || (isLoading ? "Loading todos..." : "Todos are stored in Supabase.")}
      </p>

      <ul id="todo-list" className="todo-list" aria-label="Todo items">
        {todos.length === 0 ? (
          <li className="todo-empty">No tasks yet</li>
        ) : (
          todos.map((todo) => (
            <li key={todo.id}>
              {editingId === todo.id ? (
                <div className="todo-edit-row">
                  <input
                    className="todo-edit-input"
                    type="text"
                    value={editingTitle}
                    maxLength="120"
                    aria-label="Edit todo title"
                    onChange={(event) => setEditingTitle(event.target.value)}
                  />
                  <button className="todo-action" type="button" onClick={() => saveTodo(todo)}>
                    Save todo
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="todo-check"
                    type="checkbox"
                    checked={todo.completed}
                    aria-label={`Mark ${todo.title} ${todo.completed ? "active" : "complete"}`}
                    onChange={(event) => toggleTodo(todo, event.target.checked)}
                  />
                  <span className={`todo-title${todo.completed ? " is-complete" : ""}`}>{todo.title}</span>
                  <div className="todo-actions">
                    <button className="todo-action" type="button" aria-label={`Edit ${todo.title}`} onClick={() => {
                      setEditingId(todo.id);
                      setEditingTitle(todo.title);
                    }}>
                      Edit
                    </button>
                    <button className="todo-action todo-action--danger" type="button" aria-label={`Delete ${todo.title}`} onClick={() => deleteTodo(todo)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))
        )}
      </ul>
    </>
  );
}
