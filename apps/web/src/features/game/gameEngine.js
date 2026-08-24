const MAP_WIDTH = 28;
const MAP_HEIGHT = 18;
const PLAYER_START = { x: 14, y: 9 };
const STORAGE_SAFE_MARGIN = 1;

function createRng(seed = Date.now()) {
  let value = Math.trunc(seed) % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!length) {
    return { x: 0, y: 0 };
  }

  return { x: dx / length, y: dy / length };
}

function makeFloorTiles(width, height, rng) {
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const nearStart = Math.abs(x - PLAYER_START.x) < 4 && Math.abs(y - PLAYER_START.y) < 4;
      tiles.push({
        x,
        y,
        type: edge || (!nearStart && rng() < 0.08) ? "wall" : "floor",
      });
    }
  }

  return tiles;
}

function tileAt(map, x, y) {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return map.tiles[tileY * map.width + tileX];
}

function isWalkable(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return false;
  }

  return tileAt(map, x, y)?.type === "floor";
}

function createMap(seed) {
  const rng = createRng(seed);
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles: makeFloorTiles(MAP_WIDTH, MAP_HEIGHT, rng),
  };
}

function createPlayer() {
  return {
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    hp: 20,
    maxHp: 20,
    speed: 7.5,
    attackRange: 5,
    attackDamage: 2,
    attackCooldownMs: 0,
    xp: 0,
    level: 1,
    coins: 0,
  };
}

function createEnemy(id, map, rng, elapsedMs) {
  const side = Math.floor(rng() * 4);
  const x = side === 0 ? STORAGE_SAFE_MARGIN : side === 1 ? map.width - STORAGE_SAFE_MARGIN - 1 : Math.floor(rng() * (map.width - 4)) + 2;
  const y = side === 2 ? STORAGE_SAFE_MARGIN : side === 3 ? map.height - STORAGE_SAFE_MARGIN - 1 : Math.floor(rng() * (map.height - 4)) + 2;
  const difficulty = 1 + elapsedMs / 60000;

  return {
    id: `enemy-${id}`,
    x,
    y,
    hp: Math.ceil(2 * difficulty),
    speed: 2.3 + Math.min(1.5, elapsedMs / 60000),
    damage: 2,
    xpReward: 2,
    coinReward: 1,
  };
}

export function createGame(options = {}) {
  const seed = typeof options === "number" ? options : options.seed ?? Date.now();
  const rng = createRng(seed);

  return {
    seed,
    rngState: Math.trunc(seed),
    map: createMap(seed),
    player: createPlayer(),
    enemies: [],
    effects: [],
    run: {
      elapsedMs: 0,
      score: 0,
      spawnTimerMs: 700,
      nextEnemyId: 1,
      status: "running",
    },
    _rng: rng,
  };
}

export function restartGame(options = {}) {
  return createGame(options);
}

function movePlayer(state, input, deltaSeconds) {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const direction = normalize(dx, dy);
  const nextX = clamp(state.player.x + direction.x * state.player.speed * deltaSeconds, 0, state.map.width - 1);
  const nextY = clamp(state.player.y + direction.y * state.player.speed * deltaSeconds, 0, state.map.height - 1);

  if (!isWalkable(state.map, nextX, nextY)) {
    return state.player;
  }

  return { ...state.player, x: nextX, y: nextY };
}

function moveEnemies(enemies, player, map, deltaSeconds) {
  return enemies.map((enemy) => {
    const direction = normalize(player.x - enemy.x, player.y - enemy.y);
    const nextX = clamp(enemy.x + direction.x * enemy.speed * deltaSeconds, 0, map.width - 1);
    const nextY = clamp(enemy.y + direction.y * enemy.speed * deltaSeconds, 0, map.height - 1);

    if (!isWalkable(map, nextX, nextY)) {
      return enemy;
    }

    return { ...enemy, x: nextX, y: nextY };
  });
}

function findNearestEnemyInRange(player, enemies) {
  return enemies
    .filter((enemy) => distance(player, enemy) <= player.attackRange)
    .sort((first, second) => distance(player, first) - distance(player, second))[0];
}

function applyCombat(player, enemies, deltaMs) {
  let nextPlayer = {
    ...player,
    attackCooldownMs: Math.max(0, player.attackCooldownMs - deltaMs),
  };
  let nextEnemies = enemies;
  const effects = [];

  if (nextPlayer.attackCooldownMs === 0) {
    const target = findNearestEnemyInRange(nextPlayer, enemies);

    if (target) {
      nextPlayer = { ...nextPlayer, attackCooldownMs: 420 };
      effects.push({
        type: "shot",
        fromX: nextPlayer.x,
        fromY: nextPlayer.y,
        x: target.x,
        y: target.y,
        ttlMs: 180,
      });

      nextEnemies = enemies.map((enemy) => (
        enemy.id === target.id ? { ...enemy, hp: enemy.hp - nextPlayer.attackDamage } : enemy
      ));
      effects.push({ type: "hit", x: target.x, y: target.y, ttlMs: 180 });
    }
  }

  let xpGain = 0;
  let coinGain = 0;
  nextEnemies = nextEnemies.filter((enemy) => {
    if (enemy.hp > 0) {
      return true;
    }

    xpGain += enemy.xpReward;
    coinGain += enemy.coinReward;
    effects.push({ type: "coin", x: enemy.x, y: enemy.y, ttlMs: 360 });
    return false;
  });

  if (xpGain || coinGain) {
    const totalXp = nextPlayer.xp + xpGain;
    const nextLevel = Math.floor(totalXp / 5) + 1;
    nextPlayer = {
      ...nextPlayer,
      xp: totalXp,
      coins: nextPlayer.coins + coinGain,
      level: nextLevel,
      maxHp: 20 + (nextLevel - 1) * 3,
      attackDamage: 2 + Math.floor((nextLevel - 1) / 2),
    };
  }

  for (const enemy of nextEnemies) {
    if (distance(nextPlayer, enemy) <= 0.75) {
      nextPlayer = {
        ...nextPlayer,
        hp: Math.max(0, nextPlayer.hp - enemy.damage),
      };
    }
  }

  return { player: nextPlayer, enemies: nextEnemies, effects };
}

export function stepGame(state, input = {}, deltaMs = 16) {
  if (state.run.status !== "running") {
    return state;
  }

  const safeDeltaMs = Math.min(250, Math.max(0, deltaMs));
  const deltaSeconds = safeDeltaMs / 1000;
  const rng = state._rng ?? createRng(state.seed);
  const movedPlayer = movePlayer(state, input, deltaSeconds);
  const movedEnemies = moveEnemies(state.enemies, movedPlayer, state.map, deltaSeconds);
  const combat = applyCombat(movedPlayer, movedEnemies, safeDeltaMs);
  const elapsedMs = state.run.elapsedMs + safeDeltaMs;
  const score = Math.floor(elapsedMs / 100) + combat.player.level * 10 + combat.player.coins * 5;
  let spawnTimerMs = state.run.spawnTimerMs - safeDeltaMs;
  let nextEnemyId = state.run.nextEnemyId;
  let enemies = combat.enemies;

  if (spawnTimerMs <= 0) {
    enemies = [...enemies, createEnemy(nextEnemyId, state.map, rng, elapsedMs)];
    nextEnemyId += 1;
    spawnTimerMs = Math.max(380, 950 - elapsedMs / 100);
  }

  return {
    ...state,
    _rng: rng,
    player: combat.player,
    enemies,
    effects: [
      ...combat.effects,
      ...state.effects
        .map((effect) => ({ ...effect, ttlMs: effect.ttlMs - safeDeltaMs }))
        .filter((effect) => effect.ttlMs > 0),
    ],
    run: {
      ...state.run,
      elapsedMs,
      score,
      spawnTimerMs,
      nextEnemyId,
      status: combat.player.hp <= 0 ? "game-over" : "running",
    },
  };
}
