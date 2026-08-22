import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("index page exposes calculator display, keypad, history, and controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /role="tablist"/);
  assert.match(html, /id="tab-calculator"/);
  assert.match(html, /id="tab-todos"/);
  assert.match(html, /id="display"/);
  assert.match(html, /id="expression"/);
  assert.match(html, /id="history"/);
  assert.match(html, /id="todo-form"/);
  assert.match(html, /id="todo-title"/);
  assert.match(html, /id="todo-list"/);
  assert.match(html, /data-key="clear"/);
  assert.match(html, /data-key="delete"/);
  assert.match(html, /data-key="\+"/);
  assert.match(html, /data-key="-"/);
  assert.match(html, /data-key="\*"/);
  assert.match(html, /data-key="\/"/);
  assert.match(html, /data-key="="/);
});
