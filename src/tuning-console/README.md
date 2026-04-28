# tuning-console

**Owner:** UI Agent
**Phase:** 3 (shipped)

Live parameter adjustment panel. Attaches to an active game session.
Evan changes Rule D `k` and spawn weights without restarting; grid
dimensions and prngSeed via `[New Game with these settings]`.

**Imports from:** `game-session` only.

## Files

| File | Purpose | Coverage |
|---|---|---|
| `console.ts` | Side panel: mount/destroy, sliders, advanced toggle, JSON section, session listener, rebindSession | UAT (DOM, no jsdom) |
| `controls.ts` | DOM widget factories: `makeSlider`, `makeNumberInput`, `makeButton` | UAT (DOM, no jsdom) |
| `config-export.ts` | `exportConfig` / `importConfig` with field-by-field validation | unit tests, ≥80% |

## Parameter tiers

See `docs/engineering/PARAMETER_TIERS.md` for the authoritative list.

- **Tier 1** (live sliders): `ruleK`, spawn weights for 2/4/8/16/32/64/128/256
- **Tier 2** (advanced + new-game): `gridRows`, `gridCols`, `prngSeed`
- **Tier 3** (code only): adjacency, chain-start rule, extension rule, formula shape, PRNG algo

## Public entry

```ts
import { mountTuningConsole } from './console.js';

const handle = mountTuningConsole({
  mountTarget: document.body,
  session,
  onRequestNewGame: (cfg) => {
    // UI re-creates GameSession + canvas + input here
    // and calls handle.rebindSession(newSession)
  },
});
```

## JSON export schema

Mirrors `GameConfig`. Round-trippable via `importConfig(exportConfig(config))`.
See `docs/engineering/PARAMETER_TIERS.md` §"JSON export schema".

## Toggle

`[⚙]` button in HUD top bar toggles `body[data-console-open]`. Panel is
position:fixed so toggling does not re-flow the canvas.
