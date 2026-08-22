import assert from "node:assert/strict";
import test from "node:test";

import { createTodoRepository } from "../src/lib/supabase/todos.js";

function createQueryStub(result = []) {
  const calls = [];
  const query = {
    select(columns) {
      calls.push(["select", columns]);
      return query;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return Promise.resolve({ data: result, error: null });
    },
    insert(row) {
      calls.push(["insert", row]);
      return query;
    },
    update(changes) {
      calls.push(["update", changes]);
      return query;
    },
    delete() {
      calls.push(["delete"]);
      return query;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    single() {
      calls.push(["single"]);
      return Promise.resolve({ data: result[0], error: null });
    },
  };

  return { calls, query };
}

test("todo repository rejects access without signed-in user", async () => {
  const repo = createTodoRepository({ from() {} }, () => null);

  await assert.rejects(() => repo.listTodos(), /Sign in to manage todos/);
});

test("todo repository creates todos for the current user", async () => {
  const { calls, query } = createQueryStub([
    {
      id: "todo-1",
      title: "Private task",
      completed: false,
      created_at: "2026-08-22T10:00:00Z",
      updated_at: "2026-08-22T10:00:00Z",
    },
  ]);
  const repo = createTodoRepository(
    {
      from(table) {
        calls.push(["from", table]);
        return query;
      },
    },
    () => ({ id: "user-1", email: "a@example.com" }),
  );

  const todo = await repo.createTodo("Private task");

  assert.deepEqual(todo, {
    id: "todo-1",
    title: "Private task",
    completed: false,
    createdAt: "2026-08-22T10:00:00Z",
    updatedAt: "2026-08-22T10:00:00Z",
  });
  assert.deepEqual(calls.slice(0, 4), [
    ["from", "todos"],
    ["insert", { title: "Private task", user_id: "user-1" }],
    ["select", "id,title,completed,created_at,updated_at"],
    ["single"],
  ]);
});

test("todo repository scopes update and delete operations by id", async () => {
  const { calls, query } = createQueryStub([
    {
      id: "todo-1",
      title: "Private task updated",
      completed: true,
      created_at: "2026-08-22T10:00:00Z",
      updated_at: "2026-08-22T10:01:00Z",
    },
  ]);
  const repo = createTodoRepository(
    {
      from(table) {
        calls.push(["from", table]);
        return query;
      },
    },
    () => ({ id: "user-1", email: "a@example.com" }),
  );

  await repo.updateTodo("todo-1", { title: "Private task updated", completed: true });
  await repo.deleteTodo("todo-1");

  assert.deepEqual(calls.slice(0, 6), [
    ["from", "todos"],
    ["update", { title: "Private task updated", completed: true }],
    ["eq", "id", "todo-1"],
    ["select", "id,title,completed,created_at,updated_at"],
    ["single"],
    ["from", "todos"],
  ]);
  assert.deepEqual(calls.slice(6), [
    ["delete"],
    ["eq", "id", "todo-1"],
  ]);
});

test("todo repository reports Supabase errors", async () => {
  const repo = createTodoRepository(
    {
      from() {
        return {
          select() {
            return this;
          },
          order() {
            return Promise.resolve({ data: null, error: { message: "RLS rejected request" } });
          },
        };
      },
    },
    () => ({ id: "user-1", email: "a@example.com" }),
  );

  await assert.rejects(() => repo.listTodos(), /RLS rejected request/);
});
