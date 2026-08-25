import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vite root page mounts the React app", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.jsx"/);
});

test("README documents React auth deployment environment", () => {
  const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

  assert.match(readme, /apps\/web/);
  assert.match(readme, /VITE_SUPABASE_URL/);
  assert.match(readme, /VITE_SUPABASE_ANON_KEY/);
});

test("AI Support uses a ChatGPT-style chat shell", () => {
  const component = readFileSync(new URL("../src/features/support/AiSupportPanel.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

  assert.match(component, /support-chat-shell/);
  assert.match(component, /className="support-chat-panel"/);
  assert.match(component, /className="support-sidebar-section support-sidebar-section--documents"/);
  assert.match(component, /Khi bạn sẵn sàng là chúng ta có thể bắt đầu/);
  assert.match(css, /\.support-chat-shell\s*{/);
  assert.match(css, /\.support-chat-shell\s*{[\s\S]*?--support-bg:\s*#000000/);
  assert.match(css, /\.support-chat-shell\s*{[\s\S]*?--support-sidebar-bg:\s*#050505/);
  assert.match(css, /\.support-sidebar\s*{[\s\S]*?background:\s*var\(--support-sidebar-bg\)/);
  assert.match(css, /\.support-compose\s*{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.support-compose\s*{[\s\S]*?background:\s*var\(--support-compose-bg\)/);
  assert.match(css, /\.support-compose\s*{[\s\S]*?position:\s*sticky/);
});

test("AI Support exposes theme controls and disables message input history", () => {
  const component = readFileSync(new URL("../src/features/support/AiSupportPanel.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");

  assert.match(component, /SUPPORT_THEME_STORAGE_KEY = "support-theme"/);
  assert.match(component, /window\.localStorage\.getItem\(SUPPORT_THEME_STORAGE_KEY\)/);
  assert.match(component, /window\.localStorage\.setItem\(SUPPORT_THEME_STORAGE_KEY, theme\)/);
  assert.match(component, /useState\(readStoredSupportTheme\)/);
  assert.match(component, /setTheme\(\(current\) => \(current === "dark" \? "light" : "dark"\)\)/);
  assert.match(component, /className=\{`support-chat-shell is-\$\{theme\}`\}/);
  assert.match(component, />AHV</);
  assert.match(component, /aria-label="Toggle support theme"/);
  assert.match(component, /className="support-conversation-title"/);
  assert.match(component, /className="support-conversation-title-track"/);
  assert.match(component, /autoComplete="off"/);
  assert.match(component, /name="support-chat-message"/);
  assert.match(component, /spellCheck="false"/);
  assert.match(css, /\.support-chat-shell\.is-light\s*{/);
  assert.match(css, /\.support-chat-shell\s*{[\s\S]*?grid-template-columns:\s*248px minmax\(0, 1fr\)/);
  assert.match(css, /\.support-chat-shell\s*{[\s\S]*?--support-scrollbar-thumb:/);
  assert.match(css, /\.support-sidebar::-webkit-scrollbar-thumb\s*{/);
  assert.match(css, /\.support-messages\s*{[\s\S]*?scrollbar-color:\s*var\(--support-scrollbar-thumb\) var\(--support-scrollbar-track\)/);
  assert.match(css, /\.support-messages::-webkit-scrollbar-thumb\s*{/);
  assert.doesNotMatch(css, /\.support-conversation-row \+ \.support-conversation-row\s*{[\s\S]*?border-top:/);
  assert.match(css, /@keyframes support-conversation-title-scroll/);
  assert.match(css, /\.support-conversation:hover \.support-conversation-title-track/);
  assert.match(css, /\.support-conversation:hover\s*{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.support-conversation-row\.is-selected \.support-conversation\s*{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.support-message-content strong\s*{[\s\S]*?font-weight:\s*600/);
  assert.match(css, /\.support-conversation-delete\s*{[\s\S]*?font-weight:\s*600/);
  assert.match(css, /\.support-chat-stage\s*{/);
});

test("Supabase migration upgrades existing todos to user-owned RLS", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/0001_user_owned_todos.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /add column if not exists user_id uuid references auth\.users\(id\)/i);
  assert.match(sql, /delete from public\.todos\s+where user_id is null/i);
  assert.match(sql, /alter column user_id set not null/i);
  assert.match(sql, /alter table public\.todos enable row level security/i);
  assert.match(sql, /revoke all privileges on public\.todos from anon/i);
  assert.match(sql, /grant select, delete on public\.todos to authenticated/i);
  assert.doesNotMatch(sql, /create policy[\s\S]*?\bto anon\b/i);

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`for ${operation}[\\s\\S]*?to authenticated`, "i"));
    assert.match(sql, new RegExp(`for ${operation}[\\s\\S]*?auth\\.uid\\(\\)`, "i"));
  }
});

test("Supabase migration creates profiles without storing passwords", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/0001_user_owned_todos.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table if not exists public\.profiles/i);
  assert.match(sql, /id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /email text not null/i);
  assert.match(sql, /display_name text/i);
  assert.match(sql, /alter table public\.profiles enable row level security/i);
  assert.match(sql, /create or replace function public\.handle_new_user\(\)/i);
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /for select[\s\S]*?using \(id = auth\.uid\(\)\)/i);
  assert.match(sql, /for update[\s\S]*?using \(id = auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /public\.profiles[\s\S]*?(password|password_hash|encrypted_password)/i);
});
