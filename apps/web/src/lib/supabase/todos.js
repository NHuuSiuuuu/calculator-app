const TODO_COLUMNS = "id,title,completed,created_at,updated_at";

function normalizeTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    completed: Boolean(todo.completed),
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

function requireUser(getSessionUser) {
  const user = getSessionUser();

  if (!user?.id) {
    throw new Error("Sign in to manage todos.");
  }

  return user;
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase todo request failed.");
  }
}

export function createTodoRepository(supabase, getSessionUser) {
  return {
    async listTodos() {
      requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .select(TODO_COLUMNS)
        .order("created_at", { ascending: false });
      throwIfError(error);
      return Array.isArray(data) ? data.map(normalizeTodo) : [];
    },

    async createTodo(title) {
      const user = requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .insert({ title, user_id: user.id })
        .select(TODO_COLUMNS)
        .single();
      throwIfError(error);
      return normalizeTodo(data);
    },

    async updateTodo(id, changes) {
      requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .update(changes)
        .eq("id", id)
        .select(TODO_COLUMNS)
        .single();
      throwIfError(error);
      return normalizeTodo(data);
    },

    async deleteTodo(id) {
      requireUser(getSessionUser);
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id);
      throwIfError(error);
    },
  };
}
