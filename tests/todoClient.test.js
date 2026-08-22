import assert from "node:assert/strict";
import test from "node:test";

import { createTodoClient } from "../src/todoClient.js";

function createFetchStub(responseBody = []) {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url, options });

    return {
      ok: true,
      status: 200,
      async json() {
        return responseBody;
      },
      async text() {
        return JSON.stringify(responseBody);
      },
    };
  };

  return { calls, fetchStub };
}

const config = {
  url: "https://demo.supabase.co",
  anonKey: "anon-key",
};

test("todo client reports missing Supabase config", async () => {
  const client = createTodoClient({}, async () => {
    throw new Error("fetch should not run");
  });

  assert.equal(client.isConfigured, false);
  await assert.rejects(() => client.listTodos(), /Supabase is not configured/);
});

test("todo client lists todos from Supabase REST API", async () => {
  const { calls, fetchStub } = createFetchStub([
    {
      id: "todo-1",
      title: "Ship calculator",
      completed: false,
      created_at: "2026-08-22T07:00:00Z",
      updated_at: "2026-08-22T07:00:00Z",
    },
  ]);
  const client = createTodoClient(config, fetchStub);

  const todos = await client.listTodos();

  assert.equal(calls[0].url, "https://demo.supabase.co/rest/v1/todos?select=id,title,completed,created_at,updated_at&order=created_at.desc");
  assert.equal(calls[0].options.headers.apikey, "anon-key");
  assert.equal(calls[0].options.headers.Authorization, "Bearer anon-key");
  assert.deepEqual(todos, [
    {
      id: "todo-1",
      title: "Ship calculator",
      completed: false,
      createdAt: "2026-08-22T07:00:00Z",
      updatedAt: "2026-08-22T07:00:00Z",
    },
  ]);
});

test("todo client creates, updates, and deletes todos", async () => {
  const { calls, fetchStub } = createFetchStub([
    {
      id: "todo-2",
      title: "Write docs",
      completed: false,
      created_at: "2026-08-22T08:00:00Z",
      updated_at: "2026-08-22T08:00:00Z",
    },
  ]);
  const client = createTodoClient(config, fetchStub);

  await client.createTodo("Write docs");
  await client.updateTodo("todo-2", { title: "Review docs", completed: true });
  await client.deleteTodo("todo-2");

  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Prefer, "return=representation");
  assert.equal(calls[0].options.body, JSON.stringify({ title: "Write docs" }));

  assert.equal(calls[1].url, "https://demo.supabase.co/rest/v1/todos?id=eq.todo-2");
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.body, JSON.stringify({ title: "Review docs", completed: true }));

  assert.equal(calls[2].url, "https://demo.supabase.co/rest/v1/todos?id=eq.todo-2");
  assert.equal(calls[2].options.method, "DELETE");
});

test("todo client reports Supabase status errors with non-JSON bodies", async () => {
  const client = createTodoClient(config, async () => ({
    ok: false,
    status: 500,
    async text() {
      return "upstream unavailable";
    },
  }));

  await assert.rejects(() => client.listTodos(), /upstream unavailable/);
});

test("todo client reports empty mutation responses clearly", async () => {
  const client = createTodoClient(config, async () => ({
    ok: true,
    status: 200,
    async text() {
      return "[]";
    },
  }));

  await assert.rejects(() => client.updateTodo("missing", { completed: true }), /No todo returned from Supabase/);
});
