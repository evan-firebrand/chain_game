# Chain Game — Skill-Depth Study

**Status:** A.4 baseline written; A.5 grid sweep pending.
**Generated:** 2026-04-29

---

## A.4 — Default-config baseline

### Inputs

- ruleK = 2, board = 7×6, spawnPoolMin = 2, spawnPoolMax = 256
- Spawn weights: `{"2":128,"4":64,"8":32,"16":16,"32":8,"64":4,"128":2,"256":1}`
- Strategies: random, search-d1, search-d3
- Games per strategy: 100, paired by (kernelSeed=1000+i, strategySeed=0+i)
- Game cap: 50 turns

### Per-strategy aggregates

| Strategy | mean maxTile | median maxTile | mean tier (log₂) | mean chainsPerLevel | mean avgChainLength | % cap-truncated | wall-clock total | per-game |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| random | 84.8 | 64.0 | 6.15 | 8.27 | 2.00 | 100% | 0.05s | 0.5 ms |
| search-d1 | 266.2 | 256.0 | 7.90 | 6.37 | 2.79 | 100% | 0.42s | 4.2 ms |
| search-d3 | 311.0 | 256.0 | 8.14 | 6.18 | 2.78 | 100% | 13.15s | 131.5 ms |

### Paired spreads (95% CI)

| Comparison | Δ tier (log₂ maxTile) | Δ chainsPerLevel | Δ avgChainLength |
|---|---:|---:|---:|
| d3 − random (Gap B: total depth) | 1.99 ± 0.18 | -2.09 ± 0.21 | 0.78 ± 0.01 |
| d1 − random (typical play above monkey) | 1.75 ± 0.20 | -1.89 ± 0.22 | 0.79 ± 0.01 |
| d3 − d1 (Gap C: mastery headroom) | 0.24 ± 0.14 | -0.19 ± 0.11 | -0.00 ± 0.01 |

### Per-turn maxTile trend (mean across games still running)

| turn | random | d1 | d3 |
|---:|---:|---:|---:|
| 5 | 14.2 (n=100) | 53.9 (n=100) | 65.6 (n=100) |
| 10 | 23.4 (n=100) | 72.3 (n=100) | 85.1 (n=100) |
| 15 | 27.9 (n=100) | 89.3 (n=100) | 114.9 (n=100) |
| 20 | 34.5 (n=100) | 107.2 (n=100) | 145.9 (n=100) |
| 25 | 42.2 (n=100) | 135.7 (n=100) | 183.7 (n=100) |
| 30 | 48.3 (n=100) | 167.0 (n=100) | 208.0 (n=100) |
| 35 | 58.7 (n=100) | 184.3 (n=100) | 234.9 (n=100) |
| 40 | 68.0 (n=100) | 202.9 (n=100) | 261.8 (n=100) |
| 45 | 76.2 (n=100) | 233.6 (n=100) | 286.7 (n=100) |
| 50 | 84.8 (n=100) | 266.2 (n=100) | 311.0 (n=100) |

### Late-game board snapshots (turn 30, game 0)

**random:**
```
  64    4    2    2   16   32
  64    4    2    8    4    2
   2   64   16    8    4    8
   4   16    2   16    2    8
   2    2    4    4   16   32
  64    8    8   16    8    4
   2    2    8    4    8    4
```

**search-d1:**
```
   4    2    2   16    2    2
  16    2    4    2   32    2
   2    8  128    2    2   64
 128    2    2    2    2  128
   2    2    2    2    2    2
  32    2    4   16    2    2
   2    2    2    2    4    4
```

**search-d3:**
```
   4    2    2   16    2    2
  16    2    4    2   32    2
   2    8  128    2    2   64
 128    2    2    2    2  128
   2    2    2    2    2    2
  32    2    4   16    2    2
   2    2    2    2    4    4
```

### Adaptive-checkpoint flags

- d3 vs random tier gap: **1.99** — meaningful spread visible
- random %cap-truncated: **100%** ⚠️ >80% — consider Phase 1.5 cap extension
- d3 %cap-truncated: **100%** ⚠️ >80% — d3 likely capped before late-game divergence

---

## A.5 — Grid sweep (PENDING)

Awaiting A.5a calibration → A.5b 54-cell grid → A.5c triage → A.5d selective d3.
---

## A.5a — Calibration pass

**Generated:** 2026-04-29
**Cells:** 4 × 30 d3 games × 50-turn cap.

| Cell | ruleK | board | weights | pool | mean ms/d3 game | total wall-clock |
|---|---:|---|---|---:|---:|---:|
| `k1_6x5_flat_pool12` | 1 | 6×5 | flat | 12 | 6.7 | 0.20s |
| `k2_7x6_default_pool8` | 2 | 7×6 | default | 8 | 130.4 | 3.91s |
| `k3_9x8_steep_pool12` | 3 | 9×8 | steep | 12 | 488.7 | 14.66s |
| `k2_7x6_default_pool12` | 2 | 7×6 | default | 12 | 123.2 | 3.69s |

**Aggregate:** mean 187.2 ms/d3 game across 120 calibration games (22.5s total).

**Projection:** at mean 187.2 ms/d3 game, a full 54-cell × 50-game d3 sweep would take ~8.4 minutes. Triage gates are unnecessary at these per-game costs; A.5c may default to Path C (run d3 on all 54 cells).
