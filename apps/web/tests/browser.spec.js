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

test("support can start a new chat from an existing conversation", async ({ page }) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [{ id: "conv-1", title: "Refund policy" }] }) };
      }
      if (String(url).includes("/api/conversations/conv-1/messages")) {
        return {
          ok: true,
          json: async () => ({ messages: [{ id: "message-1", role: "assistant", content: "Existing answer" }] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByRole("button", { name: "Refund policy" }).click();
  await expect(page.getByText("Existing answer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Tạo chat mới" }).click();

  await expect(page.getByText("Existing answer", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Câu hỏi")).toHaveValue("");
  await expect(page.getByText("New conversation", { exact: true })).toBeVisible();
});

test("support can delete the selected conversation", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      access_token: "user-access-token",
      user: { id: "user-1", email: "a@example.com" },
    };
    let conversations = [{ id: "conv-1", title: "Refund policy" }];
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

    window.fetch = async (url, options = {}) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations }) };
      }
      if (String(url).endsWith("/api/conversations/conv-1") && options.method === "DELETE") {
        conversations = [];
        return { ok: true, json: async () => ({ deleted: true }) };
      }
      if (String(url).includes("/api/conversations/conv-1/messages")) {
        return {
          ok: true,
          json: async () => ({ messages: [{ id: "message-1", role: "assistant", content: "Existing answer" }] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });

  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByRole("button", { name: "Refund policy" }).click();
  await expect(page.getByText("Existing answer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Xóa cuộc trò chuyện" }).click();

  await expect(page.getByRole("button", { name: "Refund policy" })).toHaveCount(0);
  await expect(page.getByText("Existing answer", { exact: true })).toHaveCount(0);
  await expect(page.getByText("New conversation", { exact: true })).toBeVisible();
  await expect(page.getByText("Conversation deleted.", { exact: true })).toHaveCount(0);
});

test("AI Support keeps the selected theme after reload", async ({ page }) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await expect(page.locator(".support-chat-shell")).toHaveClass(/is-dark/);

  await page.getByRole("button", { name: "Toggle support theme" }).click();
  await expect(page.locator(".support-chat-shell")).toHaveClass(/is-light/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("support-theme"))).toBe("light");

  await page.reload();
  await page.getByRole("tab", { name: "AI Support" }).click();

  await expect(page.locator(".support-chat-shell")).toHaveClass(/is-light/);
});

test("support conversation title scrolls on hover without stretching the sidebar", async ({ page }) => {
  const longTitle = "Quy định nghỉ phép năm và quy trình duyệt đơn nghỉ của công ty AHV Holding";
  await page.addInitScript((title) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [{ id: "conv-long", title }] }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  }, longTitle);

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  const sidebar = page.locator(".support-sidebar");
  const conversation = page.getByRole("button", { name: longTitle });
  const sidebarWidthBefore = await sidebar.evaluate((element) => element.getBoundingClientRect().width);

  await conversation.hover();
  await conversation.focus();

  await expect(page.locator(".support-conversation-title-track")).toHaveCSS("animation-name", "support-conversation-title-scroll");
  await page.waitForTimeout(350);
  const titleTrackOffset = await page.locator(".support-conversation-title-track").evaluate((element) => {
    const transform = window.getComputedStyle(element).transform;
    if (transform === "none") return 0;
    return new DOMMatrixReadOnly(transform).m41;
  });
  expect(titleTrackOffset).toBeLessThan(-0.5);
  await expect(conversation).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const sidebarWidthAfter = await sidebar.evaluate((element) => element.getBoundingClientRect().width);
  expect(sidebarWidthAfter).toBe(sidebarWidthBefore);
});

test("support desktop sidebar stays fixed while long conversations scroll", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Left sidebar is stacked above chat on mobile.");

  const messages = Array.from({ length: 36 }, (_, index) => ({
    id: `message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Long conversation message ${index + 1}. ${"Company policy detail ".repeat(18)}`,
  }));

  await page.addInitScript((conversationMessages) => {
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

    window.fetch = async (url) => {
      const path = String(url);
      if (path.endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (path.endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [{ id: "conv-long", title: "Long policy chat" }] }) };
      }
      if (path.endsWith("/api/conversations/conv-long/messages")) {
        return { ok: true, json: async () => ({ messages: conversationMessages }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  }, messages);

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByRole("button", { name: "Long policy chat" }).click();
  await expect(page.getByText("Long conversation message 1.")).toBeVisible();

  const sidebarTopBefore = await page.locator(".support-sidebar").evaluate((element) => (
    element.getBoundingClientRect().top
  ));
  await page.evaluate(() => window.scrollTo(0, 640));
  const sidebarTopAfter = await page.locator(".support-sidebar").evaluate((element) => (
    element.getBoundingClientRect().top
  ));

  expect(sidebarTopAfter).toBe(sidebarTopBefore);
});

test("support shows a scroll-to-bottom button after reading older messages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Mobile AI Support uses page scroll instead of the fixed desktop chat pane.");

  const messages = Array.from({ length: 34 }, (_, index) => ({
    id: `scroll-message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Scrollable conversation message ${index + 1}. ${"Company handbook detail ".repeat(16)}`,
  }));

  await page.addInitScript((conversationMessages) => {
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

    window.fetch = async (url) => {
      const path = String(url);
      if (path.endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (path.endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [{ id: "conv-scroll", title: "Scrollable chat" }] }) };
      }
      if (path.endsWith("/api/conversations/conv-scroll/messages")) {
        return { ok: true, json: async () => ({ messages: conversationMessages }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  }, messages);

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByRole("button", { name: "Scrollable chat" }).click();

  const messagesPane = page.locator(".support-messages");
  const scrollToBottom = page.getByRole("button", { name: "Cuộn xuống cuối cuộc trò chuyện" });
  await expect.poll(() => messagesPane.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect(scrollToBottom).toBeHidden();

  await messagesPane.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(scrollToBottom).toBeVisible();

  await scrollToBottom.click();
  await expect.poll(() => messagesPane.evaluate((element) => (
    Math.ceil(element.scrollHeight - element.scrollTop - element.clientHeight)
  ))).toBeLessThan(4);
  await expect(scrollToBottom).toBeHidden();
});

test("support shows an assistant loading bubble while waiting for an answer", async ({ page }) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (String(url).endsWith("/api/chat")) {
        return new Promise((resolve) => {
          window.resolveSupportAnswer = () => resolve({
            ok: true,
            json: async () => ({ conversationId: "conv-1", answer: "Delayed answer", sources: [] }),
          });
        });
      }
      return { ok: true, json: async () => ({}) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("Chờ câu trả lời");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText("Chờ câu trả lời", { exact: true })).toBeVisible();
  await expect(page.getByLabel("AI đang trả lời")).toBeVisible();

  await page.evaluate(() => window.resolveSupportAnswer());

  await expect(page.getByLabel("AI đang trả lời")).toHaveCount(0);
  await expect(page.getByText("Delayed answer", { exact: true })).toBeVisible();
});

test("signed-out users can use demo AI Support and see document upload", async ({ page }) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: null, role: "admin" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (String(url).endsWith("/api/documents")) {
        return { ok: true, json: async () => ({ documents: [] }) };
      }
      if (String(url).endsWith("/api/chat")) {
        return {
          ok: true,
          json: async () => ({ conversationId: "conv-1", answer: "Demo answer", sources: [] }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("hi");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText("Demo answer")).toBeVisible();
  await expect(page.getByRole("region", { name: "Company documents" })).toBeVisible();
  await expect(page.getByText("Upload .txt hoặc .md")).toBeVisible();
});

test("demo AI Support keeps document upload visible when the API is failing", async ({ page }) => {
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

    window.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Request failed with 500" }),
    });
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  await expect(page.getByRole("alert")).toContainText("Request failed with 500");
  await expect(page.getByRole("region", { name: "Company documents" })).toBeVisible();
  await expect(page.getByText("Upload .txt hoặc .md")).toBeVisible();
});

test("signed-in users can chat with AI Support without visible sources", async ({ page }) => {
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
  await expect(page.getByText("Nguồn:")).toHaveCount(0);
  await expect(page.getByText("policy.md")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Company documents" })).toHaveCount(0);
  expect(await page.evaluate(() => window.supportRequests.filter((url) => url.endsWith("/api/documents")).length)).toBe(0);
});

test("AI Support renders assistant markdown with bold text and separate bullet lines", async ({ page }) => {
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

    window.fetch = async (url) => {
      if (String(url).endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "user-1", role: "user" } }) };
      }
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (String(url).endsWith("/api/chat")) {
        return {
          ok: true,
          json: async () => ({
            conversationId: "conv-1",
            answer: "**Lịch nghỉ công ty:**\n- Tết Dương lịch: 01 ngày.\n- Quốc khánh: 02 ngày.",
            sources: [],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("Thông tin ngày nghỉ công ty");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.locator(".support-message strong", { hasText: "Lịch nghỉ công ty:" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Tết Dương lịch: 01 ngày." })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Quốc khánh: 02 ngày." })).toBeVisible();
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

test("admin support dashboard can delete an old company document", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      access_token: "admin-token",
      user: { id: "admin-1", email: "admin@example.com" },
    };
    let documents = [{
      id: "doc-old",
      filename: "old-policy.md",
      status: "ready",
      chunk_count: 3,
      error_message: null,
      created_at: "2026-08-24T10:15:00.000Z",
    }];
    window.supportDocumentRequests = [];

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

    window.fetch = async (url, options = {}) => {
      const path = String(url);
      window.supportDocumentRequests.push({ url: path, method: options.method ?? "GET" });
      if (path.endsWith("/api/me")) {
        return { ok: true, json: async () => ({ user: { id: "admin-1", role: "admin" } }) };
      }
      if (path.endsWith("/api/conversations")) {
        return { ok: true, json: async () => ({ conversations: [] }) };
      }
      if (path.endsWith("/api/documents/doc-old") && options.method === "DELETE") {
        documents = [];
        return { ok: true, json: async () => ({ deleted: true }) };
      }
      if (path.endsWith("/api/documents")) {
        return { ok: true, json: async () => ({ documents }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Not found" }) };
    };
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  const documents = page.getByRole("region", { name: "Company documents" });
  await expect(documents.getByText("old-policy.md")).toBeVisible();
  await documents.getByRole("button", { name: "Xóa tài liệu old-policy.md" }).click();

  await expect(documents.getByText("old-policy.md")).toHaveCount(0);
  expect(await page.evaluate(() => window.supportDocumentRequests)).toContainEqual({
    url: "/api/documents/doc-old",
    method: "DELETE",
  });
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
