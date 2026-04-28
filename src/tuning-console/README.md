# tuning-console

**Owner:** UI Agent
**Phase:** 3

Live parameter adjustment panel. Attaches to an active game session. Evan changes spawn weights, k, and grid dimensions without restarting.

**Imports from:** `game-session` only.

## Files

| File | Purpose | Phase |
|---|---|---|
| `console.ts` | Panel component; show/hide without affecting game state | 3 |
| `controls.ts` | Individual control widgets (sliders, dropdowns, number inputs) | 3 |
| `config-export.ts` | JSON export/import of current parameter config | 3 |

## Parameter tiers

See `docs/engineering/PARAMETER_TIERS.md` (created in Phase 3) for the full tier assignment list.

- **Tier 1** (live sliders): `k`, spawn weights per tier — take effect on next chain
- **Tier 2** (config fields): `gridWidth`, `gridHeight` — require new game
- **Tier 3** (code only): adjacency model, chain start rule — settled design, not exposed
