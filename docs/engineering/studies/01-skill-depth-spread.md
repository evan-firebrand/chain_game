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

---

## A.5b — Random + d1 grid sweep

**Generated:** 2026-04-29
**Inputs:** 54 cells × 50 paired games × {random, search-d1}, 50-turn cap, kernel seed 3000+i.
**Wall-clock:** 13.5s.

### Per-cell paired spreads (d1 − random)

| cell | k | board | weights | pool | Δ tier ± CI | Δ CPL ± CI | Δ ACL ± CI | %cap r→d1 |
|---|---:|---|---|---:|---:|---:|---:|---:|
| `k1_9x8_steep_pool12` | 1 | 9×8 | steep | 12 | 2.70 ± 0.16 | -4.67 ± 0.32 | 0.83 ± 0.01 | 100%→100% |
| `k1_9x8_steep_pool8` | 1 | 9×8 | steep | 8 | 2.68 ± 0.15 | -4.66 ± 0.32 | 0.83 ± 0.01 | 100%→100% |
| `k1_7x6_steep_pool8` | 1 | 7×6 | steep | 8 | 2.34 ± 0.19 | -3.62 ± 0.37 | 0.83 ± 0.01 | 100%→100% |
| `k1_7x6_steep_pool12` | 1 | 7×6 | steep | 12 | 2.34 ± 0.19 | -3.62 ± 0.37 | 0.83 ± 0.01 | 100%→100% |
| `k1_9x8_default_pool12` | 1 | 9×8 | default | 12 | 2.34 ± 0.32 | -2.62 ± 0.38 | 0.78 ± 0.01 | 100%→100% |
| `k1_6x5_steep_pool8` | 1 | 6×5 | steep | 8 | 2.12 ± 0.17 | -2.91 ± 0.27 | 0.83 ± 0.01 | 100%→100% |
| `k1_6x5_steep_pool12` | 1 | 6×5 | steep | 12 | 2.12 ± 0.17 | -2.91 ± 0.27 | 0.83 ± 0.01 | 100%→100% |
| `k1_9x8_default_pool8` | 1 | 9×8 | default | 8 | 2.12 ± 0.29 | -2.47 ± 0.37 | 0.78 ± 0.02 | 100%→100% |
| `k1_7x6_default_pool8` | 1 | 7×6 | default | 8 | 2.10 ± 0.25 | -2.12 ± 0.27 | 0.78 ± 0.01 | 100%→100% |
| `k1_7x6_default_pool12` | 1 | 7×6 | default | 12 | 2.10 ± 0.28 | -2.17 ± 0.31 | 0.77 ± 0.01 | 100%→100% |
| `k1_6x5_default_pool8` | 1 | 6×5 | default | 8 | 2.02 ± 0.23 | -1.83 ± 0.22 | 0.79 ± 0.01 | 100%→100% |
| `k2_9x8_default_pool8` | 2 | 9×8 | default | 8 | 1.98 ± 0.28 | -2.34 ± 0.36 | 0.77 ± 0.02 | 100%→100% |
| `k3_9x8_default_pool8` | 3 | 9×8 | default | 8 | 1.98 ± 0.28 | -2.34 ± 0.36 | 0.77 ± 0.02 | 100%→100% |
| `k2_9x8_steep_pool8` | 2 | 9×8 | steep | 8 | 1.96 ± 0.20 | -3.78 ± 0.37 | 0.82 ± 0.01 | 100%→100% |
| `k2_9x8_steep_pool12` | 2 | 9×8 | steep | 12 | 1.96 ± 0.20 | -3.78 ± 0.37 | 0.82 ± 0.01 | 100%→100% |
| `k3_9x8_steep_pool8` | 3 | 9×8 | steep | 8 | 1.96 ± 0.20 | -3.78 ± 0.37 | 0.82 ± 0.01 | 100%→100% |
| `k3_9x8_steep_pool12` | 3 | 9×8 | steep | 12 | 1.96 ± 0.20 | -3.78 ± 0.37 | 0.82 ± 0.01 | 100%→100% |
| `k2_9x8_default_pool12` | 2 | 9×8 | default | 12 | 1.92 ± 0.36 | -2.28 ± 0.42 | 0.76 ± 0.01 | 100%→100% |
| `k3_9x8_default_pool12` | 3 | 9×8 | default | 12 | 1.92 ± 0.36 | -2.28 ± 0.42 | 0.76 ± 0.01 | 100%→100% |
| `k2_7x6_steep_pool8` | 2 | 7×6 | steep | 8 | 1.84 ± 0.20 | -3.05 ± 0.38 | 0.84 ± 0.01 | 100%→100% |
| `k2_7x6_steep_pool12` | 2 | 7×6 | steep | 12 | 1.84 ± 0.20 | -3.05 ± 0.38 | 0.84 ± 0.01 | 100%→100% |
| `k3_7x6_steep_pool8` | 3 | 7×6 | steep | 8 | 1.84 ± 0.20 | -3.05 ± 0.38 | 0.84 ± 0.01 | 100%→100% |
| `k3_7x6_steep_pool12` | 3 | 7×6 | steep | 12 | 1.84 ± 0.20 | -3.05 ± 0.38 | 0.84 ± 0.01 | 100%→100% |
| `k1_6x5_default_pool12` | 1 | 6×5 | default | 12 | 1.78 ± 0.26 | -1.66 ± 0.24 | 0.79 ± 0.01 | 100%→100% |
| `k2_7x6_default_pool8` | 2 | 7×6 | default | 8 | 1.78 ± 0.26 | -1.85 ± 0.29 | 0.77 ± 0.01 | 100%→100% |
| `k3_7x6_default_pool8` | 3 | 7×6 | default | 8 | 1.78 ± 0.26 | -1.85 ± 0.29 | 0.77 ± 0.01 | 100%→100% |
| `k2_7x6_default_pool12` | 2 | 7×6 | default | 12 | 1.72 ± 0.27 | -1.87 ± 0.33 | 0.77 ± 0.01 | 100%→100% |
| `k3_7x6_default_pool12` | 3 | 7×6 | default | 12 | 1.72 ± 0.27 | -1.87 ± 0.33 | 0.77 ± 0.01 | 100%→100% |
| `k2_6x5_steep_pool8` | 2 | 6×5 | steep | 8 | 1.64 ± 0.20 | -2.40 ± 0.32 | 0.84 ± 0.01 | 100%→100% |
| `k2_6x5_steep_pool12` | 2 | 6×5 | steep | 12 | 1.64 ± 0.20 | -2.40 ± 0.32 | 0.84 ± 0.01 | 100%→100% |
| `k3_6x5_steep_pool8` | 3 | 6×5 | steep | 8 | 1.64 ± 0.20 | -2.40 ± 0.32 | 0.84 ± 0.01 | 100%→100% |
| `k3_6x5_steep_pool12` | 3 | 6×5 | steep | 12 | 1.64 ± 0.20 | -2.40 ± 0.32 | 0.84 ± 0.01 | 100%→100% |
| `k2_6x5_default_pool12` | 2 | 6×5 | default | 12 | 1.46 ± 0.19 | -1.44 ± 0.20 | 0.78 ± 0.01 | 100%→100% |
| `k3_6x5_default_pool12` | 3 | 6×5 | default | 12 | 1.46 ± 0.19 | -1.44 ± 0.20 | 0.78 ± 0.01 | 100%→100% |
| `k2_6x5_default_pool8` | 2 | 6×5 | default | 8 | 1.42 ± 0.20 | -1.39 ± 0.21 | 0.79 ± 0.01 | 100%→100% |
| `k3_6x5_default_pool8` | 3 | 6×5 | default | 8 | 1.42 ± 0.20 | -1.39 ± 0.21 | 0.79 ± 0.01 | 100%→100% |
| `k1_9x8_flat_pool8` | 1 | 9×8 | flat | 8 | 1.12 ± 0.17 | -0.54 ± 0.09 | 0.65 ± 0.01 | 100%→100% |
| `k1_6x5_flat_pool8` | 1 | 6×5 | flat | 8 | 0.96 ± 0.24 | -0.15 ± 0.38 | 0.63 ± 0.02 | 46%→48% |
| `k1_7x6_flat_pool8` | 1 | 7×6 | flat | 8 | 0.86 ± 0.19 | -0.43 ± 0.17 | 0.65 ± 0.02 | 88%→86% |
| `k2_9x8_flat_pool8` | 2 | 9×8 | flat | 8 | 0.82 ± 0.19 | -0.41 ± 0.10 | 0.67 ± 0.02 | 100%→100% |
| `k3_9x8_flat_pool8` | 3 | 9×8 | flat | 8 | 0.82 ± 0.19 | -0.41 ± 0.10 | 0.67 ± 0.02 | 100%→100% |
| `k2_6x5_flat_pool8` | 2 | 6×5 | flat | 8 | 0.72 ± 0.19 | -0.35 ± 0.42 | 0.61 ± 0.02 | 46%→38% |
| `k3_6x5_flat_pool8` | 3 | 6×5 | flat | 8 | 0.72 ± 0.19 | -0.35 ± 0.42 | 0.61 ± 0.02 | 46%→38% |
| `k2_7x6_flat_pool8` | 2 | 7×6 | flat | 8 | 0.60 ± 0.16 | -0.21 ± 0.13 | 0.65 ± 0.02 | 88%→94% |
| `k3_7x6_flat_pool8` | 3 | 7×6 | flat | 8 | 0.60 ± 0.16 | -0.21 ± 0.13 | 0.65 ± 0.02 | 88%→94% |
| `k1_9x8_flat_pool12` | 1 | 9×8 | flat | 12 | 0.50 ± 0.18 | -0.39 ± 0.16 | 0.54 ± 0.02 | 78%→48% |
| `k2_9x8_flat_pool12` | 2 | 9×8 | flat | 12 | 0.36 ± 0.19 | -0.30 ± 0.17 | 0.52 ± 0.02 | 78%→58% |
| `k3_9x8_flat_pool12` | 3 | 9×8 | flat | 12 | 0.36 ± 0.19 | -0.30 ± 0.17 | 0.52 ± 0.02 | 78%→58% |
| `k1_7x6_flat_pool12` | 1 | 7×6 | flat | 12 | 0.16 ± 0.23 | -0.24 ± 0.35 | 0.50 ± 0.03 | 16%→8% |
| `k1_6x5_flat_pool12` | 1 | 6×5 | flat | 12 | 0.14 ± 0.23 | -0.19 ± 0.24 | 0.47 ± 0.03 | 2%→0% |
| `k2_6x5_flat_pool12` | 2 | 6×5 | flat | 12 | 0.14 ± 0.30 | -0.26 ± 0.23 | 0.50 ± 0.03 | 2%→0% |
| `k2_7x6_flat_pool12` | 2 | 7×6 | flat | 12 | 0.14 ± 0.22 | -0.26 ± 0.27 | 0.52 ± 0.03 | 16%→2% |
| `k3_6x5_flat_pool12` | 3 | 6×5 | flat | 12 | 0.14 ± 0.30 | -0.26 ± 0.23 | 0.50 ± 0.03 | 2%→0% |
| `k3_7x6_flat_pool12` | 3 | 7×6 | flat | 12 | 0.14 ± 0.22 | -0.26 ± 0.27 | 0.52 ± 0.03 | 16%→2% |

### Marginal effects on Δ tier (mean across the other 3 axes)

#### Marginal: ruleK

| ruleK | mean Δ tier | mean Δ CPL | mean Δ ACL | n cells |
|---|---:|---:|---:|---:|
| 1 | 1.69 | -2.07 | 0.73 | 18 |
| 2 | 1.33 | -1.75 | 0.73 | 18 |
| 3 | 1.33 | -1.75 | 0.73 | 18 |

#### Marginal: board

| board | mean Δ tier | mean Δ CPL | mean Δ ACL | n cells |
|---|---:|---:|---:|---:|
| 6×5 | 1.29 | -1.45 | 0.73 | 18 |
| 7×6 | 1.43 | -1.82 | 0.73 | 18 |
| 9×8 | 1.64 | -2.28 | 0.73 | 18 |

#### Marginal: spawnWeights

| spawnWeights | mean Δ tier | mean Δ CPL | mean Δ ACL | n cells |
|---|---:|---:|---:|---:|
| flat | 0.52 | -0.31 | 0.58 | 18 |
| default | 1.83 | -1.96 | 0.78 | 18 |
| steep | 2.00 | -3.29 | 0.83 | 18 |

#### Marginal: poolCount

| poolCount | mean Δ tier | mean Δ CPL | mean Δ ACL | n cells |
|---|---:|---:|---:|---:|
| 8 (max=256) | 1.55 | -1.86 | 0.75 | 27 |
| 12 (max=4096) | 1.35 | -1.84 | 0.71 | 27 |

### Top-5 cells by Δ tier (d1 most beats random)

| rank | cell | Δ tier ± CI |
|---:|---|---:|
| 1 | `k1_9x8_steep_pool12` | 2.70 ± 0.16 |
| 2 | `k1_9x8_steep_pool8` | 2.68 ± 0.15 |
| 3 | `k1_7x6_steep_pool8` | 2.34 ± 0.19 |
| 4 | `k1_7x6_steep_pool12` | 2.34 ± 0.19 |
| 5 | `k1_9x8_default_pool12` | 2.34 ± 0.32 |

### Bottom-5 cells by Δ tier (d1 barely beats random)

| rank | cell | Δ tier ± CI |
|---:|---|---:|
| 1 | `k3_7x6_flat_pool12` | 0.14 ± 0.22 |
| 2 | `k3_6x5_flat_pool12` | 0.14 ± 0.30 |
| 3 | `k2_7x6_flat_pool12` | 0.14 ± 0.22 |
| 4 | `k2_6x5_flat_pool12` | 0.14 ± 0.30 |
| 5 | `k1_6x5_flat_pool12` | 0.14 ± 0.23 |

### Cap-rate scan

- Cells where 100% of both random and d1 games hit the 50-turn cap: 39 of 54
- Cells where neither strategy hit the cap: 9 of 54
