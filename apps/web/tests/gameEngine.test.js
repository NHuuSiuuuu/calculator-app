import assert from "node:assert/strict";
import test from "node:test";

import { createGame, restartGame, stepGame } from "../src/features/game/gameEngine.js";
import { loadGameStats, saveGameStats } from "../src/features/game/gameStorage.js";

test("game engine moves the player inside map bounds", () => {
  const state = createGame({ seed: 1 });
  const moved = stepGame(state, { right: true }, 200);

  assert.ok(moved.player.x > state.player.x);
  assert.ok(moved.player.x <= moved.map.width - 1);
  assert.ok(moved.player.y >= 0);
  assert.ok(moved.player.y <= moved.map.height - 1);
});

test("game engine enemies chase the player and damage on contact", () => {
  const state = createGame({ seed: 2 });
  const enemy = {
    id: "enemy-test",
    x: state.player.x + 0.1,
    y: state.player.y,
    hp: 3,
    speed: 1,
    damage: 2,
    xpReward: 1,
    coinReward: 1,
  };
  const next = stepGame({ ...state, enemies: [enemy] }, {}, 500);

  assert.ok(next.player.hp < state.player.hp);
  assert.ok(next.enemies[0].x < enemy.x);
});

test("game engine auto fires at enemies inside gun range", () => {
  const state = createGame({ seed: 3 });
  const enemy = {
    id: "enemy-test",
    x: state.player.x + 0.2,
    y: state.player.y,
    hp: 1,
    speed: 0,
    damage: 1,
    xpReward: 5,
    coinReward: 2,
  };
  const next = stepGame({
    ...state,
    enemies: [enemy],
    player: { ...state.player, attackCooldownMs: 0 },
  }, {}, 300);

  assert.equal(next.enemies.length, 0);
  assert.equal(next.player.coins, 2);
  assert.ok(next.player.level > state.player.level);
  assert.equal(next.effects.some((effect) => effect.type === "shot"), true);
});

test("game engine does not auto fire at enemies outside gun range", () => {
  const state = createGame({ seed: 34 });
  const enemy = {
    id: "enemy-far",
    x: state.player.x + 8,
    y: state.player.y,
    hp: 4,
    speed: 0,
    damage: 1,
    xpReward: 5,
    coinReward: 2,
  };
  const next = stepGame({
    ...state,
    enemies: [enemy],
    player: { ...state.player, attackCooldownMs: 0 },
  }, {}, 120);

  assert.equal(next.enemies.length, 1);
  assert.equal(next.enemies[0].hp, enemy.hp);
  assert.equal(next.effects.some((effect) => effect.type === "shot"), false);
});

test("game engine restarts a completed run", () => {
  const state = createGame({ seed: 4 });
  const restarted = restartGame({ seed: 5 });

  assert.equal(state.run.status, "running");
  assert.equal(restarted.run.status, "running");
  assert.equal(restarted.player.hp, restarted.player.maxHp);
});

test("game storage persists best score and last run", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };

  saveGameStats(storage, { bestScore: 42, lastRun: { score: 42, level: 3, coins: 9 } });

  assert.deepEqual(loadGameStats(storage), {
    bestScore: 42,
    lastRun: { score: 42, level: 3, coins: 9 },
  });
});
