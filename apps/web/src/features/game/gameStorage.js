const STORAGE_KEY = "calculator-app:dungeon-survivor:v1";

const DEFAULT_STATS = {
  bestScore: 0,
  lastRun: null,
};

function normalizeStats(value) {
  return {
    bestScore: Number.isFinite(value?.bestScore) ? value.bestScore : 0,
    lastRun: value?.lastRun && Number.isFinite(value.lastRun.score)
      ? {
        score: value.lastRun.score,
        level: Number.isFinite(value.lastRun.level) ? value.lastRun.level : 1,
        coins: Number.isFinite(value.lastRun.coins) ? value.lastRun.coins : 0,
      }
      : null,
  };
}

export function loadGameStats(storage = globalThis.localStorage) {
  if (!storage) {
    return DEFAULT_STATS;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_STATS;
    }

    return normalizeStats(JSON.parse(raw));
  } catch {
    return DEFAULT_STATS;
  }
}

export function saveGameStats(storage = globalThis.localStorage, stats) {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeStats(stats)));
}
