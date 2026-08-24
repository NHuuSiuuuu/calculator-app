import { expect, test } from "@playwright/test";

test("calculator computes with pointer input", async ({ page }) => {
  await page.goto("/");

  for (const key of ["1", "2", "+", "3", "="]) {
    await page.locator(`[data-key="${key}"]`).click();
  }

  await expect(page.locator("#display")).toHaveText("15");
  await expect(page.locator("#history")).toContainText("12 + 3 = 15");
});

test("calculator supports keyboard input and division by zero errors", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("8");
  await page.keyboard.press("/");
  await page.keyboard.press("0");
  await page.keyboard.press("Enter");

  await expect(page.locator("#error")).toHaveText("Cannot divide by zero");

  await page.keyboard.press("Escape");
  await expect(page.locator("#display")).toHaveText("0");
});

test("calculator deletes one history entry at a time", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("1");
  await page.keyboard.press("+");
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");
  await page.keyboard.press("4");
  await page.keyboard.press("*");
  await page.keyboard.press("5");
  await page.keyboard.press("Enter");

  await expect(page.locator("#history")).toContainText("1 + 2 = 3");
  await expect(page.locator("#history")).toContainText("4 * 5 = 20");

  await page.getByRole("button", { name: "Delete history item 1 + 2 = 3" }).click();

  await expect(page.locator("#history")).not.toContainText("1 + 2 = 3");
  await expect(page.locator("#history")).toContainText("4 * 5 = 20");
});

test("calculator layout is visible without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".calculator")).toBeVisible();
  await expect(page.locator("[data-key='=']")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("signed-out users see auth form instead of todos", async ({ page }) => {
  await page.addInitScript(() => {
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();

  await expect(page.getByText("Đăng nhập để quản lý Todo.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Đăng nhập" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Đăng ký" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng ký" })).not.toBeVisible();
  await expect(page.getByText("No tasks yet")).not.toBeVisible();
});

test("support keeps completed chat messages when conversation refresh fails", async ({ page }) => {
  let conversationRequestCount = 0;
  await page.addInitScript(() => {
    const session = {
      access_token: "user-access-token",
      user: { id: "user-1", email: "a@example.com" },
    };
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });
  await page.route("**/api/conversations", async (route) => {
    conversationRequestCount += 1;
    if (conversationRequestCount === 1) {
      await route.fulfill({ json: { conversations: [] } });
      return;
    }
    await route.fulfill({ status: 500, json: { error: "Conversation refresh failed" } });
  });
  await page.route("**/api/me", (route) => route.fulfill({
    json: { user: { id: "user-1", role: "admin" } },
  }));
  await page.route("**/api/documents", (route) => route.fulfill({ json: { documents: [] } }));
  await page.route("**/api/chat", (route) => route.fulfill({
    json: { conversationId: "conv-1", answer: "Answer", sources: [] },
  }));

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("Hello");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText("Hello", { exact: true })).toBeVisible();
  await expect(page.getByText("Answer", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Conversation refresh failed");
});

test("signed-out users cannot use AI Support", async ({ page }) => {
  await page.addInitScript(() => {
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  await expect(page.getByText("Đăng nhập để dùng AI Support.")).toBeVisible();
});

test("signed-in users can chat with AI Support and see sources", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      access_token: "support-token",
      user: { id: "user-1", email: "support@example.com" },
    };

    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };

    window.fetch = async (url, options) => {
      window.supportRequests ??= [];
      window.supportRequests.push(String(url));
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (String(url).endsWith("/api/documents")) {
        return { ok: false, status: 403, json: async () => ({ error: "Admin role required" }) };
      }
      if (String(url).endsWith("/api/chat")) {
        return {
          ok: true,
          json: async () => ({
            conversationId: "conv-1",
            answer: "Chính sách hoàn tiền là 7 ngày.",
            sources: [{ chunkId: "chunk-1", filename: "policy.md", similarity: 0.88 }],
          }),
        };
      }
      return { ok: true, json: async () => [] };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("Chính sách hoàn tiền thế nào?");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText("Chính sách hoàn tiền là 7 ngày.")).toBeVisible();
  await expect(page.getByText("policy.md")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Company documents" })).toHaveCount(0);
  expect(await page.evaluate(() => window.supportRequests.filter((url) => url.endsWith("/api/documents")).length)).toBe(0);
});

test("admin support dashboard displays document ingestion metadata", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      access_token: "admin-token",
      user: { id: "admin-1", email: "admin@example.com" },
    };

    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "admin-1", role: "admin" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (String(url).endsWith("/api/documents")) {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: "doc-1",
              filename: "broken.md",
              status: "failed",
              chunk_count: 0,
              error_message: "Embedding failed",
              created_at: "2026-08-24T10:15:00.000Z",
            }],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  const documents = page.getByRole("region", { name: "Company documents" });
  await expect(documents.getByText("broken.md")).toBeVisible();
  await expect(documents.getByText("failed", { exact: true })).toBeVisible();
  await expect(documents.getByText("0 chunks", { exact: true })).toBeVisible();
  await expect(documents.getByText("2026-08-24 10:15 UTC", { exact: true })).toBeVisible();
  await expect(documents.getByText("Embedding failed", { exact: true })).toBeVisible();
});

test("support discards a stale conversation response after the account changes", async ({ page }) => {
  await page.addInitScript(() => {
    const firstSession = {
      access_token: "token-user-1",
      user: { id: "user-1", email: "one@example.com" },
    };
    const secondSession = {
      access_token: "token-user-2",
      user: { id: "user-2", email: "two@example.com" },
    };
    let authListener;

    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: firstSession }, error: null };
        },
        onAuthStateChange(listener) {
          authListener = listener;
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
    window.switchSupportAccount = () => authListener("SIGNED_IN", secondSession);

    window.fetch = async (url, options = {}) => {
      const token = options.headers?.authorization;
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: token.endsWith("user-2") ? "user-2" : "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return {
          ok: true,
          json: async () => ({
            conversations: token.endsWith("user-2") ? [] : [{ id: "conv-user-1", title: "Private user one chat" }],
          }),
        };
      }
      if (String(url).includes("/api/conversations/conv-user-1/messages")) {
        return new Promise((resolve) => {
          window.resolveOldConversation = () => resolve({
            ok: true,
            json: async () => ({
              messages: [{ id: "message-user-1", role: "assistant", content: "Private answer for user one" }],
            }),
          });
        });
      }
      return { ok: false, status: 403, json: async () => ({ error: "Admin role required" }) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByRole("button", { name: "Private user one chat" }).click();
  await page.evaluate(() => window.switchSupportAccount());
  await page.evaluate(() => window.resolveOldConversation());

  await expect(page.getByText("Private user one chat", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Private answer for user one", { exact: true })).toHaveCount(0);
});

test("users can create an account before signing in", async ({ page }) => {
  await page.addInitScript(() => {
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        async signUp() {
          return { data: { session: null }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();
  await page.getByRole("tab", { name: "Đăng ký" }).click();

  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page.getByRole("status")).toContainText("Đã tạo tài khoản");
  await expect(page.getByText("No tasks yet")).not.toBeVisible();
});

test("signup tab validates required credentials before calling Supabase", async ({ page }) => {
  await page.addInitScript(() => {
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        async signUp() {
          throw new Error("Supabase signup should not be called for an invalid form.");
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();
  await page.getByRole("tab", { name: "Đăng ký" }).click();
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page.getByRole("alert")).toContainText("Nhập email trước khi đăng ký.");
});

test("signed-in users can manage only authenticated todos and sign out", async ({ page }) => {
  await page.addInitScript(() => {
    const todos = [];
    const session = {
      access_token: "user-access-token",
      user: { id: "user-1", email: "a@example.com" },
    };

    function queryBuilder() {
      const builder = {
        operation: "",
        payload: null,
        id: null,
        select() {
          return builder;
        },
        order() {
          return Promise.resolve({ data: todos, error: null });
        },
        insert(row) {
          builder.operation = "insert";
          builder.payload = row;
          return builder;
        },
        update(changes) {
          builder.operation = "update";
          builder.payload = changes;
          return builder;
        },
        delete() {
          builder.operation = "delete";
          return builder;
        },
        eq(_column, value) {
          builder.id = value;
          if (builder.operation === "delete") {
            const index = todos.findIndex((todo) => todo.id === builder.id);
            if (index >= 0) {
              todos.splice(index, 1);
            }
            return Promise.resolve({ error: null });
          }
          return builder;
        },
        single() {
          if (builder.operation === "insert") {
            const todo = {
              id: `todo-${todos.length + 1}`,
              title: builder.payload.title,
              user_id: builder.payload.user_id,
              completed: false,
              created_at: "2026-08-22T10:00:00Z",
              updated_at: "2026-08-22T10:00:00Z",
            };
            todos.unshift(todo);
            return Promise.resolve({ data: todo, error: null });
          }

          const todo = todos.find((item) => item.id === builder.id);
          Object.assign(todo, builder.payload, { updated_at: "2026-08-22T10:01:00Z" });
          return Promise.resolve({ data: todo, error: null });
        },
      };

      return builder;
    }

    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        async signInWithPassword() {
          return { data: { session }, error: null };
        },
        async signUp() {
          return { data: { session }, error: null };
        },
        async signOut() {
          return { error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
      from(table) {
        if (table !== "todos") {
          throw new Error(`Unexpected table ${table}`);
        }
        return queryBuilder();
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();

  await page.getByLabel("Email").fill("a@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(page.getByText("Đang đăng nhập bằng")).toBeVisible();
  await expect(page.getByText("a@example.com")).toBeVisible();

  await page.getByLabel("New todo").fill("Ship private todo");
  await page.getByRole("button", { name: "Add todo" }).click();
  await expect(page.getByText("Ship private todo")).toBeVisible();

  await page.getByRole("checkbox", { name: "Mark Ship private todo complete" }).click();
  await expect(page.getByText("Ship private todo")).toHaveClass(/is-complete/);

  await page.getByRole("button", { name: "Edit Ship private todo" }).click();
  await page.getByLabel("Edit todo title").fill("Review private todo");
  await page.getByRole("button", { name: "Save todo" }).click();
  await expect(page.getByText("Review private todo")).toBeVisible();

  await page.getByRole("button", { name: "Delete Review private todo" }).click();
  await expect(page.getByText("No tasks yet")).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByText("Đăng nhập để quản lý Todo.")).toBeVisible();
  await expect(page.getByText("No tasks yet")).not.toBeVisible();
});
