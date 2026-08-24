# Dungeon Survivor Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a playable `Dungeon Survivor` mini roguelike as the third app tab.

**Architecture:** Keep game rules in a deterministic engine module, persistence in a storage helper, and React focused on rendering/input. Render the game in a responsive canvas with keyboard and touch controls.

**Tech Stack:** React, Vite, JavaScript modules, Canvas 2D, `node:test`, Playwright, `localStorage`.

**Spec:** `docs/superpowers/specs/2026-08-24-dungeon-survivor-game-design.md`

## Global Constraints

- Version 1 includes player movement, enemy chase AI, manual attack, HP/damage, XP/level, coins, random spawn/map, game over, restart, high score, and desktop/mobile controls.
- Shop is out of scope for version 1.
- Game save data uses `localStorage`; no Supabase-backed game saves in version 1.
- Existing calculator, todo, and auth behavior must remain unchanged.
- `npm test`, `npm run test:e2e`, and `npm run build` must pass.

---

### Task 1: Deterministic Game Engine

**Files:**
- Create: `apps/web/src/features/game/gameEngine.js`
- Test: `apps/web/tests/gameEngine.test.js`

**Interfaces:**
- Produces: `createGame(seedOrOptions)`, `stepGame(state, input, deltaMs)`, `restartGame(seedOrOptions)`
- Produces state fields: `player`, `enemies`, `map`, `run`, `effects`

- [x] **Step 1: Write failing engine tests**

```js
test("game engine moves the player inside map bounds", () => {
  const state = createGame({ seed: 1 });
  const moved = stepGame(state, { right: true }, 200);
  assert.ok(moved.player.x > state.player.x);
  assert.ok(moved.player.x <= moved.map.width - 1);
});

test("game engine enemies chase the player and damage on contact", () => {
  const state = createGame({ seed: 2 });
  const enemy = { id: "enemy-test", x: state.player.x + 0.1, y: state.player.y, hp: 3, speed: 1, damage: 2, xpReward: 1, coinReward: 1 };
  const next = stepGame({ ...state, enemies: [enemy] }, {}, 500);
  assert.ok(next.player.hp < state.player.hp);
});

test("game engine attacks enemies, grants xp, coins, and levels", () => {
  const state = createGame({ seed: 3 });
  const enemy = { id: "enemy-test", x: state.player.x + 0.2, y: state.player.y, hp: 1, speed: 0, damage: 1, xpReward: 5, coinReward: 2 };
  const next = stepGame({ ...state, enemies: [enemy], player: { ...state.player, attackCooldownMs: 0 } }, {}, 300);
  assert.equal(next.enemies.length, 0);
  assert.equal(next.player.coins, 2);
  assert.ok(next.player.level > state.player.level);
});
```

- [x] **Step 2: Run RED**

Run: `npm test -- gameEngine.test.js`
Expected: FAIL because `gameEngine.js` does not exist.

- [x] **Step 3: Implement engine**

Create a seedable RNG, map generation, movement bounds, enemy spawning, enemy chase, attack resolution, contact damage, XP/level, coins, score, and game-over status.

- [x] **Step 4: Run GREEN**

Run: `npm test -- gameEngine.test.js`
Expected: PASS.

### Task 2: Game Storage

**Files:**
- Create: `apps/web/src/features/game/gameStorage.js`
- Test: `apps/web/tests/gameEngine.test.js`

**Interfaces:**
- Produces: `loadGameStats(storage)`, `saveGameStats(storage, stats)`
- Stats shape: `{ bestScore: number, lastRun: { score: number, level: number, coins: number } | null }`

- [x] **Step 1: Write failing storage tests**

```js
test("game storage persists best score and last run", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  saveGameStats(storage, { bestScore: 42, lastRun: { score: 42, level: 3, coins: 9 } });
  assert.deepEqual(loadGameStats(storage), { bestScore: 42, lastRun: { score: 42, level: 3, coins: 9 } });
});
```

- [x] **Step 2: Run RED**

Run: `npm test -- gameEngine.test.js`
Expected: FAIL because storage helpers do not exist.

- [x] **Step 3: Implement storage helpers**

Use key `calculator-app:dungeon-survivor:v1` and defensive JSON parsing.

- [x] **Step 4: Run GREEN**

Run: `npm test -- gameEngine.test.js`
Expected: PASS.

### Task 3: React Game Panel

**Files:**
- Create: `apps/web/src/features/game/GamePanel.jsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/tests/browser.spec.js`

**Interfaces:**
- Consumes: `createGame`, `stepGame`, `restartGame`, `loadGameStats`, `saveGameStats`
- Produces: visible heading `Dungeon Survivor`, canvas label `Dungeon Survivor map`, buttons `Up`, `Down`, `Left`, `Right`, `Restart run`

- [x] **Step 1: Write failing e2e test for game panel**

```js
test("game tab renders a playable Dungeon Survivor surface", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Game" }).click();
  await expect(page.getByRole("heading", { name: "Dungeon Survivor" })).toBeVisible();
  await expect(page.getByLabel("Dungeon Survivor map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Restart run" })).toBeVisible();
});
```

- [x] **Step 2: Run RED**

Run: `npm run test:e2e -- --grep "Dungeon Survivor"`
Expected: FAIL because `Game` tab does not exist.

- [x] **Step 3: Implement GamePanel**

Use `requestAnimationFrame`, canvas drawing, keyboard listeners, touch buttons, HUD, game-over panel, and high-score persistence.

- [x] **Step 4: Run GREEN**

Run: `npm run test:e2e -- --grep "Dungeon Survivor"`
Expected: PASS on desktop and mobile.

### Task 4: App Integration and Verification

**Files:**
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/tests/browser.spec.js`

**Interfaces:**
- Consumes: `GamePanel`
- Produces: app tab `Game` with `panel-game`

- [x] **Step 1: Add `Game` tab to App**

Import `GamePanel`, add `activeTab === "game"` handling, and render a `tabpanel` with `id="panel-game"`.

- [x] **Step 2: Add movement e2e check**

Use canvas screenshot or exposed HUD position text to verify keyboard movement changes player state.

- [x] **Step 3: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
```

Expected: all pass.

- [x] **Step 4: Commit and push**

```bash
git add apps/web/src apps/web/tests docs/superpowers/plans/2026-08-24-dungeon-survivor-game.md
git commit -m "Add Dungeon Survivor game tab"
git push
```
