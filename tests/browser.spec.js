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

test("calculator layout is visible without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".calculator")).toBeVisible();
  await expect(page.locator("[data-key='=']")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
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

test("focused history delete buttons work with Enter", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("1");
  await page.keyboard.press("+");
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");

  const deleteButton = page.getByRole("button", { name: "Delete history item 1 + 2 = 3" });
  await deleteButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#history")).not.toContainText("1 + 2 = 3");
  await expect(page.locator("#history")).toContainText("No calculations yet");
});

test("focused calculator buttons still allow keyboard shortcuts", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-key='clear']").focus();
  await page.keyboard.press("5");
  await page.keyboard.press("+");
  await page.keyboard.press("2");

  await expect(page.locator("#display")).toHaveText("2");
  await expect(page.locator("#expression")).toHaveText("5 +");
});

test("todo tab creates, completes, edits, and deletes Supabase todos", async ({ page }) => {
  const todos = [];

  await page.addInitScript(() => {
    window.APP_CONFIG = {
      supabase: {
        url: "https://demo.supabase.co",
        anonKey: "anon-key",
      },
    };
  });

  await page.route("https://demo.supabase.co/rest/v1/todos**", async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === "GET") {
      await route.fulfill({ json: todos });
      return;
    }

    if (method === "POST") {
      const body = request.postDataJSON();
      const todo = {
        id: "todo-1",
        title: body.title,
        completed: false,
        created_at: "2026-08-22T09:00:00Z",
        updated_at: "2026-08-22T09:00:00Z",
      };
      todos.unshift(todo);
      await route.fulfill({ json: [todo] });
      return;
    }

    if (method === "PATCH") {
      const body = request.postDataJSON();
      Object.assign(todos[0], body, { updated_at: "2026-08-22T09:01:00Z" });
      await route.fulfill({ json: [todos[0]] });
      return;
    }

    if (method === "DELETE") {
      todos.splice(0, todos.length);
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fallback();
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();

  await expect(page.getByText("No tasks yet")).toBeVisible();

  await page.getByLabel("New todo").fill("Ship Supabase todo");
  await page.getByRole("button", { name: "Add todo" }).click();

  await expect(page.getByText("Ship Supabase todo")).toBeVisible();

  await page.getByRole("checkbox", { name: "Mark Ship Supabase todo complete" }).click();
  await expect(page.getByText("Ship Supabase todo")).toHaveClass(/is-complete/);

  await page.getByRole("button", { name: "Edit Ship Supabase todo" }).click();
  await page.getByLabel("Edit todo title").fill("Review Supabase todo");
  await page.getByRole("button", { name: "Save todo" }).click();

  await expect(page.getByText("Review Supabase todo")).toBeVisible();

  await page.getByRole("button", { name: "Delete Review Supabase todo" }).click();
  await expect(page.getByText("No tasks yet")).toBeVisible();
});

test("app tabs support arrow, home, and end keyboard navigation", async ({ page }) => {
  await page.goto("/");

  const calculatorTab = page.getByRole("tab", { name: "Calculator" });
  const todoTab = page.getByRole("tab", { name: "Todo List" });

  await calculatorTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(todoTab).toHaveAttribute("aria-selected", "true");
  await expect(todoTab).toHaveAttribute("tabindex", "0");

  await page.keyboard.press("Home");
  await expect(calculatorTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(todoTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowLeft");
  await expect(calculatorTab).toHaveAttribute("aria-selected", "true");
});
