const TODO_COLUMNS = "id,title,completed,created_at,updated_at";

function normalizeConfig(config = {}) {
  const supabaseConfig = config.supabase ?? config;

  return {
    url: String(supabaseConfig.url ?? "").replace(/\/+$/, ""),
    anonKey: String(supabaseConfig.anonKey ?? ""),
  };
}

function normalizeTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    completed: Boolean(todo.completed),
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function normalizeFirstTodo(todos) {
  if (!Array.isArray(todos) || !todos[0]) {
    throw new Error("No todo returned from Supabase.");
  }

  return normalizeTodo(todos[0]);
}

export function createTodoClient(config = {}, fetchImpl = globalThis.fetch) {
  const { url, anonKey } = normalizeConfig(config);
  const isConfigured = Boolean(url && anonKey);

  function assertConfigured() {
    if (!isConfigured) {
      throw new Error("Supabase is not configured. Add url and anonKey to config.js.");
    }

    if (typeof fetchImpl !== "function") {
      throw new Error("Fetch is not available in this browser.");
    }
  }

  function createHeaders(extraHeaders = {}) {
    return {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    };
  }

  async function request(path, options = {}) {
    assertConfigured();

    const response = await fetchImpl(`${url}/rest/v1/${path}`, {
      ...options,
      headers: createHeaders(options.headers),
    });

    const body = await parseResponse(response);

    if (!response.ok) {
      const rawText = typeof body?.rawText === "string" ? body.rawText.slice(0, 160) : "";
      const message = body?.message ?? body?.error ?? (rawText || `Supabase request failed with status ${response.status}`);
      throw new Error(message);
    }

    return body;
  }

  return {
    isConfigured,

    async listTodos() {
      const todos = await request(`todos?select=${TODO_COLUMNS}&order=created_at.desc`);
      return Array.isArray(todos) ? todos.map(normalizeTodo) : [];
    },

    async createTodo(title) {
      const todos = await request("todos", {
        method: "POST",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({ title }),
      });

      return normalizeFirstTodo(todos);
    },

    async updateTodo(id, changes) {
      const todos = await request(`todos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(changes),
      });

      return normalizeFirstTodo(todos);
    },

    async deleteTodo(id) {
      await request(`todos?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
  };
}
