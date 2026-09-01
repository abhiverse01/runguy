# RUNGUY — Open Field (Godmode Rebuild)

A small open-world 3D exploration game. Cross the river, climb the hill,
collect the orbs — now with dash, double-jump and ground-slam, a
rebuilt player model, richer terrain/props, and a real project structure
so it's easy to keep building on.

Built with **Three.js** + **Vite**. Single self-contained HTML build → modular
ES-module game.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173, hot reload
npm run build      # production build → dist/
npm run preview   # serve the production build locally
```

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrows | left joystick |
| Look | drag mouse, or click 🔒 to pointer-lock | drag right half of screen |
| Sprint | Shift | SPRINT button |
| Jump | Space | JUMP button |
| Double jump | Space again, mid-air | JUMP button again, mid-air |
| Dash | Q | DASH button |
| Ground slam | E, mid-air | SLAM button |
| Pause | Esc | ❚❚ button |

## What changed vs. the old single-file build

**Real bugs fixed:**
- `tryDash()` / `trySlam()` were bound to keydown but never defined
  anywhere — pressing Q or E threw a `ReferenceError`. Dash and slam
  are now fully implemented (`Player.requestDash` / `requestSlam`),
  with cooldowns, stamina cost, particle bursts, screen shake and SFX.
- Double jump was referenced in the audio table and the changelog
  comment but had no code path at all. It's now real, edge-triggered
  off a single key press so holding Space can't auto-chain into it.
- Camera/movement smoothing switched from fixed-rate `lerp(x, target,
  rate*dt)` (visible stutter under frame-time spikes) to a
  critically-damped spring (`utils/math.js#springDamp`) for the camera.
- Obstacle collision now resolves in two relaxation passes instead of
  one, so standing between two overlapping props doesn't jitter.

**World & props:**
- Added a shallow valley landmark, reed clusters along the riverbank,
  bushes with four flower-color variants, fallen logs, mushroom
  clusters, and lantern posts on each bridge.
- Every subsystem (terrain height, water shape, bridge placement,
  vegetation exclusion zones) now reads from one shared `RiverPath`
  instance instead of each re-deriving the river layout — the old
  single-file build kept these in sync by convention only.

**Player:**
- Rebuilt around a spine/hip hierarchy with a backpack, distinct
  shoes, idle breathing animation, and a dash lean/scarf-flap.
- Three new abilities layered onto the original walk/sprint/jump.

**Structure:** one 2,300-line HTML file → 22 focused modules (see below),
so a feature now touches one file instead of a global scope.

## Project layout

```
runguy/
├── index.html              # markup shell only — no game logic
├── package.json / vite.config.js
├── src/
│   ├── main.js              # composition root: builds every system, owns the loop
│   ├── style.css
│   ├── config/
│   │   └── constants.js     # every tunable number lives here
│   ├── utils/
│   │   └── math.js          # noise, smoothstep, spring-damping, seeded RNG
│   ├── world/
│   │   ├── RiverPath.js     # single authority for river curve + bridge placement
│   │   ├── Terrain.js       # heightfield, mesh, ground/normal sampling
│   │   ├── River.js         # water surface + riverbed
│   │   ├── Bridges.js       # bridge meshes + lanterns
│   │   ├── Vegetation.js    # trees, rocks, grass, bushes, logs, mushrooms, reeds
│   │   └── SkyEnvironment.js# sky, sun/shadow-follow, fog, clouds
│   ├── entities/
│   │   ├── Player.js        # model + physics/locomotion + abilities
│   │   └── Collectibles.js  # Orbs + QuestMarkers
│   ├── systems/
│   │   ├── InputManager.js  # keyboard/touch/pointer-lock -> one clean API
│   │   ├── AudioManager.js  # synthesized SFX, no audio files
│   │   ├── ParticleSystem.js
│   │   ├── CameraController.js
│   │   └── QuestSystem.js
│   └── ui/
│       ├── HUD.js           # compass, quest log, minimap, stats, toasts
│       └── Overlays.js      # loading/start/pause/dev-modal screens
```

## Extending it

- **New ability:** add tunables to `config/constants.js` under
  `ABILITIES`, add a `requestX()` method + state on `Player`, wire an
  input event in `main.js`.
- **New prop:** add a `_buildX()` method to `world/Vegetation.js`
  following the existing pattern (instanced mesh, `isClearSpot` guard,
  push to `obstacles` only if it should block the player).
- **New quest:** add an entry in `systems/QuestSystem.js#buildQuestDefinitions`;
  the HUD quest log and compass pips pick it up automatically if it has
  a `marker`.
- **New landmark/terrain feature:** add a center point to
  `config/constants.js` and a term to `Terrain.baseHeight()`.
- **Persistence / save state / a menu system / multiplayer:** none of
  that exists yet — `main.js` is the natural place to introduce a
  `GameState` module once you need one.

## Notes

- World generation is deterministic (seeded RNG in `main.js`) — same
  layout every load, which matters once quest/orb positions need to be
  shareable or testable.
- Quality toggle (`Low`/`High`) scales shadow resolution, grass/prop
  density, pixel ratio cap and fog distance — see `Q` in
  `config/constants.js`.
