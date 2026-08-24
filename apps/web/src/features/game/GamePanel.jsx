import { useEffect, useRef, useState } from "react";

import { createGame, restartGame, stepGame } from "./gameEngine.js";
import { loadGameStats, saveGameStats } from "./gameStorage.js";

const INPUT_KEYS = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

function drawGame(canvas, state) {
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const tileWidth = width / state.map.width;
  const tileHeight = height / state.map.height;
  const tileSize = Math.min(tileWidth, tileHeight);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#111827";
  context.fillRect(0, 0, width, height);

  for (const tile of state.map.tiles) {
    context.fillStyle = tile.type === "wall" ? "#334155" : "#182235";
    context.fillRect(tile.x * tileWidth, tile.y * tileHeight, tileWidth + 0.5, tileHeight + 0.5);
  }

  for (const effect of state.effects) {
    if (effect.type !== "coin") {
      continue;
    }

    context.globalAlpha = Math.max(0.2, effect.ttlMs / 360);
    context.fillStyle = "#facc15";
    context.beginPath();
    context.arc((effect.x + 0.5) * tileWidth, (effect.y + 0.5) * tileHeight, tileSize * 0.42, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  for (const enemy of state.enemies) {
    const enemyX = (enemy.x + 0.5) * tileWidth;
    const enemyY = (enemy.y + 0.5) * tileHeight;
    const bodySize = tileSize * 0.7;

    context.fillStyle = "#991b1b";
    context.beginPath();
    context.roundRect(enemyX - bodySize / 2, enemyY - bodySize / 2, bodySize, bodySize, 4);
    context.fill();
    context.fillStyle = "#ef4444";
    context.beginPath();
    context.arc(enemyX, enemyY - bodySize * 0.24, tileSize * 0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fecaca";
    context.fillRect(enemyX - tileSize * 0.16, enemyY - tileSize * 0.06, tileSize * 0.08, tileSize * 0.08);
    context.fillRect(enemyX + tileSize * 0.08, enemyY - tileSize * 0.06, tileSize * 0.08, tileSize * 0.08);
  }

  const playerX = (state.player.x + 0.5) * tileWidth;
  const playerY = (state.player.y + 0.5) * tileHeight;
  const activeShot = state.effects.find((effect) => effect.type === "shot");
  const aimX = activeShot ? activeShot.x - state.player.x : 1;
  const aimY = activeShot ? activeShot.y - state.player.y : 0;
  const aimLength = Math.hypot(aimX, aimY) || 1;
  const unitX = aimX / aimLength;
  const unitY = aimY / aimLength;

  context.fillStyle = "#0f766e";
  context.beginPath();
  context.roundRect(playerX - tileSize * 0.24, playerY - tileSize * 0.08, tileSize * 0.48, tileSize * 0.46, 4);
  context.fill();
  context.fillStyle = "#fde68a";
  context.beginPath();
  context.arc(playerX, playerY - tileSize * 0.24, tileSize * 0.22, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#111827";
  context.lineWidth = Math.max(3, tileSize * 0.1);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(playerX + unitX * tileSize * 0.1, playerY - tileSize * 0.02 + unitY * tileSize * 0.1);
  context.lineTo(playerX + unitX * tileSize * 0.65, playerY - tileSize * 0.02 + unitY * tileSize * 0.65);
  context.stroke();

  for (const effect of state.effects.filter((item) => item.type === "shot")) {
    const fromX = (effect.fromX + 0.5) * tileWidth;
    const fromY = (effect.fromY + 0.5) * tileHeight;
    const targetX = (effect.x + 0.5) * tileWidth;
    const targetY = (effect.y + 0.5) * tileHeight;

    context.save();
    context.globalAlpha = 1;
    context.strokeStyle = "#facc15";
    context.lineWidth = Math.max(4, tileSize * 0.14);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(targetX, targetY);
    context.stroke();
    context.fillStyle = "#f97316";
    context.beginPath();
    context.arc(fromX, fromY, tileSize * 0.18, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (const effect of state.effects.filter((item) => item.type === "hit")) {
    const centerX = (effect.x + 0.5) * tileWidth;
    const centerY = (effect.y + 0.5) * tileHeight;

    context.strokeStyle = "#fde047";
    context.lineWidth = Math.max(2, tileSize * 0.08);
    context.beginPath();
    context.moveTo(centerX - tileSize * 0.28, centerY);
    context.lineTo(centerX + tileSize * 0.28, centerY);
    context.moveTo(centerX, centerY - tileSize * 0.28);
    context.lineTo(centerX, centerY + tileSize * 0.28);
    context.stroke();
  }

  context.strokeStyle = "rgba(34, 197, 94, 0.35)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc((state.player.x + 0.5) * tileWidth, (state.player.y + 0.5) * tileHeight, state.player.attackRange * tileWidth, 0, Math.PI * 2);
  context.stroke();
}

function formatPosition(player) {
  return `Position ${player.x.toFixed(2)}, ${player.y.toFixed(2)}`;
}

function getAttackStatus(game) {
  if (game.effects.some((effect) => effect.type === "shot")) {
    return "Firing";
  }

  return game.player.attackCooldownMs > 0 ? "Reloading" : "Auto fire";
}

export function GamePanel() {
  const [game, setGame] = useState(() => createGame({ seed: Date.now() }));
  const [stats, setStats] = useState(() => loadGameStats());
  const canvasRef = useRef(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false });
  const gameRef = useRef(game);
  const lastFrameRef = useRef(0);
  const savedGameOverRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawGame(canvas, game);
    }

    if (game.run.status === "game-over" && !savedGameOverRef.current) {
      savedGameOverRef.current = true;
      const nextStats = {
        bestScore: Math.max(stats.bestScore, game.run.score),
        lastRun: {
          score: game.run.score,
          level: game.player.level,
          coins: game.player.coins,
        },
      };
      saveGameStats(globalThis.localStorage, nextStats);
      setStats(nextStats);
    }
  }, [game, stats.bestScore]);

  useEffect(() => {
    function handleKey(event, isPressed) {
      const direction = INPUT_KEYS[event.code];
      if (!direction) {
        return;
      }

      event.preventDefault();
      inputRef.current = { ...inputRef.current, [direction]: isPressed };
    }

    const handleKeyDown = (event) => handleKey(event, true);
    const handleKeyUp = (event) => handleKey(event, false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;

    function tick(timestamp) {
      if (!lastFrameRef.current) {
        lastFrameRef.current = timestamp;
      }

      const deltaMs = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;
      const nextGame = stepGame(gameRef.current, inputRef.current, deltaMs);
      setGame(nextGame);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, []);

  function setTouchDirection(direction, isPressed) {
    inputRef.current = { ...inputRef.current, [direction]: isPressed };
  }

  function handleRestart() {
    inputRef.current = { up: false, down: false, left: false, right: false };
    savedGameOverRef.current = false;
    lastFrameRef.current = 0;
    setGame(restartGame({ seed: Date.now() }));
  }

  return (
    <section className="game-panel app-panel" aria-label="Dungeon Survivor">
      <header className="game-panel__header">
        <div>
          <p className="eyebrow">Mini Roguelike</p>
          <h1>Dungeon Survivor</h1>
        </div>
        <button className="game-button" type="button" onClick={handleRestart}>Restart run</button>
      </header>

      <div className="game-hud" aria-label="Game stats">
        <span>HP {game.player.hp}/{game.player.maxHp}</span>
        <span>Level {game.player.level}</span>
        <span>XP {game.player.xp}</span>
        <span>Coins {game.player.coins}</span>
        <span>Score {game.run.score}</span>
        <span>Best {stats.bestScore}</span>
      </div>

      <div className="game-stage">
        <canvas
          ref={canvasRef}
          className="game-canvas"
          width="560"
          height="360"
          aria-label="Dungeon Survivor map"
        />
        {game.run.status === "game-over" ? (
          <div className="game-over" role="status">
            <strong>Game over</strong>
            <span>Score {game.run.score}</span>
          </div>
        ) : null}
      </div>

      <div className="game-footer">
        <span data-testid="player-position">{formatPosition(game.player)}</span>
        <span>{game.enemies.length} enemies</span>
        <span
          className={getAttackStatus(game) === "Firing" ? "game-attack-effect is-active" : "game-attack-effect"}
          data-testid="attack-effect"
        >
          {getAttackStatus(game)}
        </span>
      </div>

      <div className="game-controls" aria-label="Touch controls">
        <button
          className="game-control game-control--up"
          type="button"
          aria-label="Move up"
          onPointerDown={() => setTouchDirection("up", true)}
          onPointerUp={() => setTouchDirection("up", false)}
          onPointerLeave={() => setTouchDirection("up", false)}
        >
          ↑
        </button>
        <button
          className="game-control game-control--left"
          type="button"
          aria-label="Move left"
          onPointerDown={() => setTouchDirection("left", true)}
          onPointerUp={() => setTouchDirection("left", false)}
          onPointerLeave={() => setTouchDirection("left", false)}
        >
          ←
        </button>
        <button
          className="game-control game-control--right"
          type="button"
          aria-label="Move right"
          onPointerDown={() => setTouchDirection("right", true)}
          onPointerUp={() => setTouchDirection("right", false)}
          onPointerLeave={() => setTouchDirection("right", false)}
        >
          →
        </button>
        <button
          className="game-control game-control--down"
          type="button"
          aria-label="Move down"
          onPointerDown={() => setTouchDirection("down", true)}
          onPointerUp={() => setTouchDirection("down", false)}
          onPointerLeave={() => setTouchDirection("down", false)}
        >
          ↓
        </button>
      </div>
    </section>
  );
}
