# Dungeon Survivor Game Design

## Goal

Add a third app tab, `Game`, containing a playable 2D mini roguelike named `Dungeon Survivor`. The game should feel like a small tool inside the current React app, not a separate landing page.

## Version 1 Scope

Version 1 is a focused survival loop:

- Player moves around a random tile map.
- Enemies spawn over time and chase the player.
- Player automatically fires at enemies inside gun range.
- Player has HP and takes contact damage.
- Enemies grant XP and coins when defeated.
- XP increases the player level.
- Score increases with survival time and defeated enemies.
- High score and last run summary persist in `localStorage`.
- Game supports desktop keyboard controls and mobile touch controls.
- Game has restart and game-over states.

Shop is intentionally deferred to v2. It needs item design, economy balance, and additional UI. Version 1 should leave coins in place so shop can be added cleanly later.

## Player Experience

The user opens the `Game` tab and sees a compact game surface with HUD stats above or beside it:

- HP
- Level
- XP
- Coins
- Score
- Best score

Desktop controls:

- `WASD` and arrow keys move the player.
- Restart button starts a new run after game over.

Mobile controls:

- D-pad direction control below the game surface.
- Auto fire status below the game surface.
- Restart button remains accessible.

## Game Model

Game logic should live outside React in a deterministic engine module. React owns rendering, input wiring, and layout.

Core state:

- `player`: position, velocity intent, hp, maxHp, attackRange, attackDamage, attackCooldown, xp, level, coins
- `enemies`: id, position, hp, speed, damage, xpReward, coinReward
- `map`: width, height, tile list, walls/floors
- `run`: elapsedMs, score, spawnTimer, status
- `storage`: bestScore, lastRun

Core engine functions:

- `createGame(seed?)`
- `stepGame(state, input, deltaMs)`
- `restartGame(seed?)`
- `loadGameStats(storage)`
- `saveGameStats(storage, stats)`

Randomness should be seedable in tests, even if production uses `Date.now()`.

## Rendering

Use a lightweight DOM/CSS grid or canvas implementation inside `GamePanel`. Canvas is preferred for the game surface because enemies and player movement are frame-based. Visuals should use simple shapes and color tokens; no external art assets are required for v1.

The game surface must have stable dimensions:

- Desktop: wide enough for readable movement and HUD.
- Mobile: constrained to viewport width with no horizontal overflow.

## Files

Expected additions:

- `apps/web/src/features/game/gameEngine.js`
- `apps/web/src/features/game/gameStorage.js`
- `apps/web/src/features/game/GamePanel.jsx`
- `apps/web/tests/gameEngine.test.js`

Expected edits:

- `apps/web/src/App.jsx`
- `apps/web/src/App.css`
- `apps/web/tests/browser.spec.js`

## Testing

Unit tests:

- Player movement stays inside map bounds.
- Enemy moves toward player.
- Player auto fire damages and removes enemies inside gun range.
- Enemy contact damage reduces HP.
- XP and level increase after kills.
- Coin and high-score values persist through storage helpers.

E2E tests:

- `Game` tab is visible.
- Game canvas/surface renders on desktop and mobile.
- Keyboard movement changes player position.
- Mobile D-pad controls are visible.
- Restart returns game to a running state after game over.

## Out of Scope for v1

- Shop UI and purchasable upgrades
- Multiple weapons
- Supabase-backed game saves
- Multiplayer
- Complex procedural dungeon rooms
- Pixel art asset pipeline

## Success Criteria

- The app has a working `Game` tab.
- A user can play a short survival run on desktop and mobile.
- The implementation is separated into engine, storage, and React UI.
- Existing calculator, todo, and auth behavior remain unchanged.
- `npm test`, `npm run test:e2e`, and `npm run build` pass.
