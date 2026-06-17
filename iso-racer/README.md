# Iso Racer

An isometric 3D arcade car racing game built with [Babylon.js](https://www.babylonjs.com/), TypeScript and Vite.

Race three AI opponents around a twisty circuit over 3 laps, grab glowing pickups for boost charges, and chain boosts down the straights to take P1.

## Quick start

```bash
npm install
npm run dev      # start dev server (opens http://localhost:5173)
npm run build    # typecheck + production bundle into dist/
npm run preview  # preview the production build
```

## Controls

| Action | Keys |
| ------ | ---- |
| Accelerate / Reverse | `W` / `S` or `↑` / `↓` |
| Steer | `A` / `D` or `←` / `→` |
| Boost (uses a charge) | `Space` or `Shift` |
| Start race | click **RACE** or press `Enter` / `Space` |

Touch controls are supported: left side of the screen steers, right side
throttles, upper-right corner boosts.

## Architecture

The code is split into small, composable pieces so new features slot in without
rewrites. Everything tree-shakes from `@babylonjs/core` via deep imports to keep
bundles lean.

```
src/
├── main.ts                 # entry point — boots the Game
├── core/                   # framework-level building blocks
│   ├── Game.ts             # engine bootstrap + render loop
│   ├── SceneManager.ts     # registers & switches between scenes
│   ├── IScene.ts           # scene contract
│   ├── IsoCamera.ts        # orthographic isometric follow camera
│   ├── Entity.ts           # base for world objects (cars, powerups)
│   └── System.ts           # base for per-frame logic (input, AI, rules)
├── entities/
│   ├── TrackPath.ts        # data-only Catmull-Rom racing line
│   ├── Track.ts            # road ribbon, ground, curbs, checkpoints
│   ├── Car.ts              # arcade vehicle + visual juice
│   └── Powerup.ts          # spinning pickups with respawn
├── systems/
│   ├── InputSystem.ts      # keyboard/touch -> car controls
│   ├── AISystem.ts         # look-ahead steering + cornering throttle
│   ├── RaceSystem.ts       # countdown, laps, checkpoints, standings
│   └── PowerupSystem.ts    # spawning + collision/effect resolution
├── ui/
│   └── HUD.ts              # speed, lap, position, boost, countdown
├── scenes/
│   ├── MenuScene.ts        # title screen
│   ├── RaceScene.ts        # composes the whole race
│   └── ResultsScene.ts     # post-race standings
└── utils/
    ├── Config.ts           # all gameplay tunables in one place
    └── math.ts             # small math helpers
```

### Key ideas

- **Scenes** are independent screens managed by `SceneManager`. Register a new
  one with `manager.register("key", (m) => new MyScene(m))`.
- **Entities** are visual world objects with an `update(dt)`; **Systems** are
  per-frame logic operating over collections of entities. This entity/system
  split keeps responsibilities clear and additive.
- **`RaceScene.update`** runs systems in a deterministic order:
  `input → ai → car physics → race rules → powerups → camera → hud`.
- **Tuning** lives entirely in `utils/Config.ts` — adjust handling, boost,
  laps, camera angle, AI behaviour without touching logic.

### Extending the game

- **New powerup**: add a kind to `PowerupKind`, a colour in `Powerup.ts`, and an
  effect branch in `PowerupSystem.applyEffect`.
- **New track**: change the control points returned by
  `RaceScene.buildCircuitPoints()` — checkpoints and AI adapt automatically.
- **New mechanic** (weapons, weather, lap records): write a `System`, then add
  one line in `RaceScene.start()` to instantiate and `init()` it.
- **New screen**: implement `IScene` and register it in `Game`.
```
