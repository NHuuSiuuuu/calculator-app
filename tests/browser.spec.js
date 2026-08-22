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
