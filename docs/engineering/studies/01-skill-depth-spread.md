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

---

## A.5c — Triage decision

**Generated:** 2026-04-29

**Path chosen: C (full 54-cell d3 grid).**

Rationale: A.5a calibration measured mean d3 wall-clock at 187 ms/game (worst cell 489 ms). A full 54-cell × 50-game d3 grid projects to ~8 min at mean rate / ~22 min worst-case — both comfortably inside the 3 CPU-hr budget. Triage gating was designed to skip d3 in cells where d1≈random; given the actual cost, that economy is unnecessary.

A.5b also surfaced wide spread variation across cells (0.14 to 2.70 tier on d1−random). Running d3 on the full grid lets us see whether the d1 ranking holds at d3, and where mastery headroom (d3−d1) actually appears.

---

## A.5d — Full d3 sweep (Path C)

**Generated:** 2026-04-29
**Inputs:** 54 cells × 50 paired games × {random, d1, d3}, 50-turn cap, kernel seed 3000+i.
**Wall-clock:** 7.4 min (443.6s).

### Per-cell paired tier spreads

| cell | k | board | weights | pool | Δ tier d3−r | Δ tier d1−r | Δ tier d3−d1 (headroom) | %cap r→d1→d3 |
|---|---:|---|---|---:|---:|---:|---:|---:|
| `k1_9x8_steep_pool8` | 1 | 9×8 | steep | 8 | 3.10 ± 0.19 | 2.68 ± 0.15 | 0.42 ± 0.15 | 100%→100%→100% |
| `k1_9x8_steep_pool12` | 1 | 9×8 | steep | 12 | 3.10 ± 0.19 | 2.70 ± 0.16 | 0.40 ± 0.15 | 100%→100%→100% |
| `k1_7x6_steep_pool8` | 1 | 7×6 | steep | 8 | 2.72 ± 0.20 | 2.34 ± 0.19 | 0.38 ± 0.18 | 100%→100%→100% |
| `k1_7x6_steep_pool12` | 1 | 7×6 | steep | 12 | 2.72 ± 0.20 | 2.34 ± 0.19 | 0.38 ± 0.18 | 100%→100%→100% |
| `k1_9x8_default_pool8` | 1 | 9×8 | default | 8 | 2.66 ± 0.26 | 2.12 ± 0.29 | 0.54 ± 0.20 | 100%→100%→100% |
| `k1_6x5_steep_pool8` | 1 | 6×5 | steep | 8 | 2.62 ± 0.19 | 2.12 ± 0.17 | 0.50 ± 0.17 | 100%→100%→100% |
| `k1_6x5_steep_pool12` | 1 | 6×5 | steep | 12 | 2.62 ± 0.19 | 2.12 ± 0.17 | 0.50 ± 0.17 | 100%→100%→100% |
| `k1_9x8_default_pool12` | 1 | 9×8 | default | 12 | 2.62 ± 0.33 | 2.34 ± 0.32 | 0.28 ± 0.26 | 100%→100%→100% |
| `k1_7x6_default_pool8` | 1 | 7×6 | default | 8 | 2.60 ± 0.22 | 2.10 ± 0.25 | 0.50 ± 0.18 | 100%→100%→100% |
| `k1_7x6_default_pool12` | 1 | 7×6 | default | 12 | 2.50 ± 0.27 | 2.10 ± 0.28 | 0.40 ± 0.22 | 100%→100%→100% |
| `k2_9x8_default_pool8` | 2 | 9×8 | default | 8 | 2.34 ± 0.29 | 1.98 ± 0.28 | 0.36 ± 0.23 | 100%→100%→100% |
| `k3_9x8_default_pool8` | 3 | 9×8 | default | 8 | 2.34 ± 0.29 | 1.98 ± 0.28 | 0.36 ± 0.23 | 100%→100%→100% |
| `k1_6x5_default_pool8` | 1 | 6×5 | default | 8 | 2.24 ± 0.20 | 2.02 ± 0.23 | 0.22 ± 0.18 | 100%→100%→100% |
| `k1_6x5_default_pool12` | 1 | 6×5 | default | 12 | 2.24 ± 0.22 | 1.78 ± 0.26 | 0.46 ± 0.19 | 100%→100%→100% |
| `k2_9x8_default_pool12` | 2 | 9×8 | default | 12 | 2.18 ± 0.31 | 1.92 ± 0.36 | 0.26 ± 0.27 | 100%→100%→100% |
| `k3_9x8_default_pool12` | 3 | 9×8 | default | 12 | 2.18 ± 0.31 | 1.92 ± 0.36 | 0.26 ± 0.27 | 100%→100%→100% |
| `k2_9x8_steep_pool8` | 2 | 9×8 | steep | 8 | 2.16 ± 0.20 | 1.96 ± 0.20 | 0.20 ± 0.19 | 100%→100%→100% |
| `k3_9x8_steep_pool8` | 3 | 9×8 | steep | 8 | 2.16 ± 0.20 | 1.96 ± 0.20 | 0.20 ± 0.19 | 100%→100%→100% |
| `k2_9x8_steep_pool12` | 2 | 9×8 | steep | 12 | 2.14 ± 0.19 | 1.96 ± 0.20 | 0.18 ± 0.18 | 100%→100%→100% |
| `k3_9x8_steep_pool12` | 3 | 9×8 | steep | 12 | 2.14 ± 0.19 | 1.96 ± 0.20 | 0.18 ± 0.18 | 100%→100%→100% |
| `k2_7x6_default_pool12` | 2 | 7×6 | default | 12 | 2.10 ± 0.26 | 1.72 ± 0.27 | 0.38 ± 0.18 | 100%→100%→100% |
| `k2_7x6_steep_pool8` | 2 | 7×6 | steep | 8 | 2.10 ± 0.20 | 1.84 ± 0.20 | 0.26 ± 0.13 | 100%→100%→100% |
| `k2_7x6_steep_pool12` | 2 | 7×6 | steep | 12 | 2.10 ± 0.20 | 1.84 ± 0.20 | 0.26 ± 0.13 | 100%→100%→100% |
| `k3_7x6_default_pool12` | 3 | 7×6 | default | 12 | 2.10 ± 0.26 | 1.72 ± 0.27 | 0.38 ± 0.18 | 100%→100%→100% |
| `k3_7x6_steep_pool8` | 3 | 7×6 | steep | 8 | 2.10 ± 0.20 | 1.84 ± 0.20 | 0.26 ± 0.13 | 100%→100%→100% |
| `k3_7x6_steep_pool12` | 3 | 7×6 | steep | 12 | 2.10 ± 0.20 | 1.84 ± 0.20 | 0.26 ± 0.13 | 100%→100%→100% |
| `k2_7x6_default_pool8` | 2 | 7×6 | default | 8 | 2.08 ± 0.26 | 1.78 ± 0.26 | 0.30 ± 0.15 | 100%→100%→100% |
| `k3_7x6_default_pool8` | 3 | 7×6 | default | 8 | 2.08 ± 0.26 | 1.78 ± 0.26 | 0.30 ± 0.15 | 100%→100%→100% |
| `k2_6x5_default_pool12` | 2 | 6×5 | default | 12 | 1.96 ± 0.26 | 1.46 ± 0.19 | 0.50 ± 0.25 | 100%→100%→100% |
| `k3_6x5_default_pool12` | 3 | 6×5 | default | 12 | 1.96 ± 0.26 | 1.46 ± 0.19 | 0.50 ± 0.25 | 100%→100%→100% |
| `k2_6x5_default_pool8` | 2 | 6×5 | default | 8 | 1.92 ± 0.19 | 1.42 ± 0.20 | 0.50 ± 0.20 | 100%→100%→100% |
| `k3_6x5_default_pool8` | 3 | 6×5 | default | 8 | 1.92 ± 0.19 | 1.42 ± 0.20 | 0.50 ± 0.20 | 100%→100%→100% |
| `k2_6x5_steep_pool8` | 2 | 6×5 | steep | 8 | 1.82 ± 0.16 | 1.64 ± 0.20 | 0.18 ± 0.17 | 100%→100%→100% |
| `k2_6x5_steep_pool12` | 2 | 6×5 | steep | 12 | 1.82 ± 0.16 | 1.64 ± 0.20 | 0.18 ± 0.17 | 100%→100%→100% |
| `k3_6x5_steep_pool8` | 3 | 6×5 | steep | 8 | 1.82 ± 0.16 | 1.64 ± 0.20 | 0.18 ± 0.17 | 100%→100%→100% |
| `k3_6x5_steep_pool12` | 3 | 6×5 | steep | 12 | 1.82 ± 0.16 | 1.64 ± 0.20 | 0.18 ± 0.17 | 100%→100%→100% |
| `k1_9x8_flat_pool8` | 1 | 9×8 | flat | 8 | 1.52 ± 0.17 | 1.12 ± 0.17 | 0.40 ± 0.18 | 100%→100%→100% |
| `k1_6x5_flat_pool8` | 1 | 6×5 | flat | 8 | 1.48 ± 0.23 | 0.96 ± 0.24 | 0.52 ± 0.23 | 46%→48%→58% |
| `k1_7x6_flat_pool8` | 1 | 7×6 | flat | 8 | 1.42 ± 0.18 | 0.86 ± 0.19 | 0.56 ± 0.17 | 88%→86%→86% |
| `k2_9x8_flat_pool8` | 2 | 9×8 | flat | 8 | 1.12 ± 0.17 | 0.82 ± 0.19 | 0.30 ± 0.18 | 100%→100%→100% |
| `k3_9x8_flat_pool8` | 3 | 9×8 | flat | 8 | 1.12 ± 0.17 | 0.82 ± 0.19 | 0.30 ± 0.18 | 100%→100%→100% |
| `k2_6x5_flat_pool8` | 2 | 6×5 | flat | 8 | 1.08 ± 0.19 | 0.72 ± 0.19 | 0.36 ± 0.21 | 46%→38%→64% |
| `k3_6x5_flat_pool8` | 3 | 6×5 | flat | 8 | 1.08 ± 0.19 | 0.72 ± 0.19 | 0.36 ± 0.21 | 46%→38%→64% |
| `k2_7x6_flat_pool8` | 2 | 7×6 | flat | 8 | 0.94 ± 0.16 | 0.60 ± 0.16 | 0.34 ± 0.14 | 88%→94%→90% |
| `k3_7x6_flat_pool8` | 3 | 7×6 | flat | 8 | 0.94 ± 0.16 | 0.60 ± 0.16 | 0.34 ± 0.14 | 88%→94%→90% |
| `k1_6x5_flat_pool12` | 1 | 6×5 | flat | 12 | 0.86 ± 0.34 | 0.14 ± 0.23 | 0.72 ± 0.32 | 2%→0%→0% |
| `k1_9x8_flat_pool12` | 1 | 9×8 | flat | 12 | 0.72 ± 0.19 | 0.50 ± 0.18 | 0.22 ± 0.12 | 78%→48%→62% |
| `k1_7x6_flat_pool12` | 1 | 7×6 | flat | 12 | 0.64 ± 0.25 | 0.16 ± 0.23 | 0.48 ± 0.21 | 16%→8%→6% |
| `k2_6x5_flat_pool12` | 2 | 6×5 | flat | 12 | 0.58 ± 0.39 | 0.14 ± 0.30 | 0.44 ± 0.28 | 2%→0%→0% |
| `k3_6x5_flat_pool12` | 3 | 6×5 | flat | 12 | 0.58 ± 0.39 | 0.14 ± 0.30 | 0.44 ± 0.28 | 2%→0%→0% |
| `k2_9x8_flat_pool12` | 2 | 9×8 | flat | 12 | 0.56 ± 0.18 | 0.36 ± 0.19 | 0.20 ± 0.14 | 78%→58%→62% |
| `k3_9x8_flat_pool12` | 3 | 9×8 | flat | 12 | 0.56 ± 0.18 | 0.36 ± 0.19 | 0.20 ± 0.14 | 78%→58%→62% |
| `k2_7x6_flat_pool12` | 2 | 7×6 | flat | 12 | 0.32 ± 0.22 | 0.14 ± 0.22 | 0.18 ± 0.13 | 16%→2%→4% |
| `k3_7x6_flat_pool12` | 3 | 7×6 | flat | 12 | 0.32 ± 0.22 | 0.14 ± 0.22 | 0.18 ± 0.13 | 16%→2%→4% |

### Marginal effects on Δ tier (d3 − random)

#### Marginal: ruleK

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 1 | 2.13 | 0.64 | 3.10 | 18 |
| 2 | 1.63 | 0.32 | 2.34 | 18 |
| 3 | 1.63 | 0.32 | 2.34 | 18 |

#### Marginal: board

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 6×5 | 1.69 | 0.58 | 2.62 | 18 |
| 7×6 | 1.77 | 0.32 | 2.72 | 18 |
| 9×8 | 1.93 | 0.56 | 3.10 | 18 |

#### Marginal: spawnWeights

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| flat | 0.88 | 0.32 | 1.52 | 18 |
| default | 2.22 | 1.92 | 2.66 | 18 |
| steep | 2.29 | 1.82 | 3.10 | 18 |

#### Marginal: poolCount

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 8 (max=256) | 1.91 | 0.94 | 3.10 | 27 |
| 12 (max=4096) | 1.69 | 0.32 | 3.10 | 27 |

### Marginal effects on Δ tier (d3 − d1: mastery headroom)

#### Marginal: ruleK

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 1 | 0.44 | 0.22 | 0.72 | 18 |
| 2 | 0.30 | 0.18 | 0.50 | 18 |
| 3 | 0.30 | 0.18 | 0.50 | 18 |

#### Marginal: board

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 6×5 | 0.40 | 0.18 | 0.72 | 18 |
| 7×6 | 0.34 | 0.18 | 0.56 | 18 |
| 9×8 | 0.29 | 0.18 | 0.54 | 18 |

#### Marginal: spawnWeights

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| flat | 0.36 | 0.18 | 0.72 | 18 |
| default | 0.39 | 0.22 | 0.54 | 18 |
| steep | 0.28 | 0.18 | 0.50 | 18 |

#### Marginal: poolCount

| value | mean Δ | min cell Δ | max cell Δ | n cells |
|---|---:|---:|---:|---:|
| 8 (max=256) | 0.36 | 0.18 | 0.56 | 27 |
| 12 (max=4096) | 0.33 | 0.18 | 0.72 | 27 |

### Top-5 cells by Δ tier (d3 − random)

| rank | cell | Δ d3−r | Δ d1−r | Δ d3−d1 |
|---:|---|---:|---:|---:|
| 1 | `k1_9x8_steep_pool8` | 3.10 ± 0.19 | 2.68 ± 0.15 | 0.42 ± 0.15 |
| 2 | `k1_9x8_steep_pool12` | 3.10 ± 0.19 | 2.70 ± 0.16 | 0.40 ± 0.15 |
| 3 | `k1_7x6_steep_pool8` | 2.72 ± 0.20 | 2.34 ± 0.19 | 0.38 ± 0.18 |
| 4 | `k1_7x6_steep_pool12` | 2.72 ± 0.20 | 2.34 ± 0.19 | 0.38 ± 0.18 |
| 5 | `k1_9x8_default_pool8` | 2.66 ± 0.26 | 2.12 ± 0.29 | 0.54 ± 0.20 |

### Bottom-5 cells by Δ tier (d3 − random)

| rank | cell | Δ d3−r | Δ d1−r | Δ d3−d1 |
|---:|---|---:|---:|---:|
| 1 | `k3_7x6_flat_pool12` | 0.32 ± 0.22 | 0.14 ± 0.22 | 0.18 ± 0.13 |
| 2 | `k2_7x6_flat_pool12` | 0.32 ± 0.22 | 0.14 ± 0.22 | 0.18 ± 0.13 |
| 3 | `k3_9x8_flat_pool12` | 0.56 ± 0.18 | 0.36 ± 0.19 | 0.20 ± 0.14 |
| 4 | `k2_9x8_flat_pool12` | 0.56 ± 0.18 | 0.36 ± 0.19 | 0.20 ± 0.14 |
| 5 | `k3_6x5_flat_pool12` | 0.58 ± 0.39 | 0.14 ± 0.30 | 0.44 ± 0.28 |

### Top-10 cells by mastery headroom (d3 − d1)

Largest gaps between d3 and d1 — cells where look-ahead beyond depth-1 actually helps.

| rank | cell | Δ d3−d1 ± CI | Δ d3−r | %cap d1→d3 |
|---:|---|---:|---:|---:|
| 1 | `k1_6x5_flat_pool12` | 0.72 ± 0.32 | 0.86 ± 0.34 | 0%→0% |
| 2 | `k1_7x6_flat_pool8` | 0.56 ± 0.17 | 1.42 ± 0.18 | 86%→86% |
| 3 | `k1_9x8_default_pool8` | 0.54 ± 0.20 | 2.66 ± 0.26 | 100%→100% |
| 4 | `k1_6x5_flat_pool8` | 0.52 ± 0.23 | 1.48 ± 0.23 | 48%→58% |
| 5 | `k1_6x5_steep_pool8` | 0.50 ± 0.17 | 2.62 ± 0.19 | 100%→100% |
| 6 | `k1_6x5_steep_pool12` | 0.50 ± 0.17 | 2.62 ± 0.19 | 100%→100% |
| 7 | `k1_7x6_default_pool8` | 0.50 ± 0.18 | 2.60 ± 0.22 | 100%→100% |
| 8 | `k2_6x5_default_pool8` | 0.50 ± 0.20 | 1.92 ± 0.19 | 100%→100% |
| 9 | `k2_6x5_default_pool12` | 0.50 ± 0.25 | 1.96 ± 0.26 | 100%→100% |
| 10 | `k3_6x5_default_pool8` | 0.50 ± 0.20 | 1.92 ± 0.19 | 100%→100% |

### Headline summary

- Mean Δ tier (d3 − random) across the 54-cell scoped world: **1.80** (range 0.32 to 3.10).
- Mean Δ tier (d3 − d1) across the scoped world: **0.35** (range 0.18 to 0.72).
- 39/54 cells fully cap-truncated for all 3 strategies.

---

## A.6 — Findings & Phase 1.5 recommendation

**Status:** Synthesis based on A.4 baseline + A.5a-d grid sweep. The 54-cell scoped world is fully covered at d1; d3 ran on every cell.

### Headline answer: does the bare kernel have skill depth?

**Yes, modestly. The depth is shallow.**

| Strategy gap | Mean Δ tier across 54 cells | Range | Interpretation |
|---|---:|---|---|
| d3 − random (Gap B: total game depth) | **1.80** | 0.32 to 3.10 | Skilled play scores ~3.5× the max tile of monkey play. |
| d1 − random | **1.45** (≈81% of Gap B) | 0.14 to 2.70 | One-move-ahead captures most of the spread. |
| d3 − d1 (Gap C: mastery headroom) | **0.35** | 0.18 to 0.72 | Looking deeper than 1 move adds little. The ceiling is close to typical play. |

The bare chain mechanic — Design Journal §1.4's load-bearing assumption — holds: there *is* a skill curve. But the slope is short. A player who picks the best immediate chain is most of the way to optimal play.

### Where the spread is biggest, and why it doesn't matter much

Top 3 cells by d3 − random (the cells where bare-kernel skill matters most):

1. `k1_9x8_steep_pool8`  — 3.10 ± 0.19
2. `k1_9x8_steep_pool12` — 3.10 ± 0.19
3. `k1_7x6_steep_pool8`  — 2.72 ± 0.20

Pattern: low-ruleK + large-board + steep weights. These are the cells where the spawn distribution is most predictable (steep) and the board is largest (most options), so look-ahead has more room to pay off.

But the d3 − d1 gap on these top cells is only 0.40 tier. Even at the design's most-favorable point, deep search beats greedy by less than half a tier. **Mastery headroom is tight everywhere we looked.**

### The four marginals

Mean Δ tier (d3 − random) along each axis, holding the others mixed:

| axis | low | mid | high | swing |
|---|---:|---:|---:|---:|
| **spawnWeights** | flat 0.88 | default 2.22 | steep 2.29 | **+1.41** |
| **ruleK** | k=1 2.13 | k=2 1.63 | k=3 1.63 | **+0.50 (and a step)** |
| **board** | 6×5 1.69 | 7×6 1.77 | 9×8 1.93 | **+0.24** |
| **poolCount** | 8 → 1.91 | 12 → 1.69 | — | **−0.22** |

`spawnWeights` is the dominant axis: flat-weight cells produce 2.6× narrower spread than steep-weight cells. The other three axes are second-order.

### Three surprises worth flagging

**1. ruleK collapses: k=2 and k=3 are mechanically identical.**

Every cell pair (k=2, k=3) with otherwise identical configuration produces *byte-identical* tier spread. Examples:

```
k2_9x8_default_pool8 : 2.34 ± 0.29
k3_9x8_default_pool8 : 2.34 ± 0.29   ← identical to 2 decimal places, identical CIs

k2_7x6_steep_pool8   : 2.10 ± 0.20
k3_7x6_steep_pool8   : 2.10 ± 0.20   ← identical

k2_6x5_default_pool12: 1.96 ± 0.26
k3_6x5_default_pool12: 1.96 ± 0.26   ← identical
```

This doesn't appear to be a sampling fluke — it holds across all 9 (board × weights × pool) combinations. Hypotheses (untested):
- Chains produced by random + d1 + d3 in 50 turns rarely have ≥3 same-value extensions, so the k≥3 branch of the rule never fires. The k=1→2 transition is observable; k=2→3 is dead code in practice.
- Or the kernel rule is "≥k same-extensions trigger the bonus", and at k=2 every observed long chain already has ≥2 same-extensions, so increasing to k=3 doesn't change behavior.

Either way, **ruleK as a 1-vs-2 binary axis explains the data**; the k=3 row of this study collected zero new information beyond k=2. Flagging for kernel-spec verification (`docs/Merge_Game_Specification.md` §rule-D) and a unit test that demonstrates k=2 and k=3 producing measurably different chain results.

**2. The 50-turn cap is binding everywhere it matters.**

39 of 54 cells: 100% of all games (random, d1, d3) hit the 50-turn cap. Only 9 cells have games that ever end naturally — and those are the lowest-spread cells, all flat-weight + pool-12 combinations where games saturate quickly because the spawn pool generates ~equal counts of every tile from 2 to 4096 (creating an unmergeable mess).

So we are measuring "**how high can each strategy push max tile in 50 turns**" — not "how deep is the game." The 50-turn cap that bounded compute also bounds the experiment's reach into late-game divergence, which is precisely where skill curves typically separate.

**3. d1 board states equal d3 board states on individual seeds.**

The A.4 turn-30 snapshots for game 0 show d1 and d3 reaching *byte-identical* boards. They picked the same chain on every turn. This isn't a bug — it just means that when d1's greedy choice happens to coincide with d3's deeper-evaluated choice (which is most of the time on this seed), the games trace identical trajectories. The aggregate `d3 − d1 = 0.35 tier` mean comes from the ~20-30% of games where d3 picks differently on at least one turn.

### Where the grid pinned at edges (Phase 1.5 axis-extension triggers)

- **ruleK = 1 produces the biggest spread**, and the slope continues to rise as k drops. We capped the axis at k=1 (no k=0 in the design). No extension possible — but worth noting that "lower k = more depth" is the trend.
- **Board = 9×8 produces the biggest spread**, and the slope continues to rise as board grows. Larger boards (10×8? 12×10?) might produce even larger spread. Phase 1.5 candidate.
- **Steep weights produce the biggest spread**, and the slope is steepest from default → steep. Even-steeper weights might widen further.
- **Pool count = 8 (default) > 12.** The slope is reversed: pool=12 actually narrows spread. The hypothesis "spawnPoolMax should matter least" is half-confirmed: small effect, but it points toward the *narrower* tile range being more strategy-sensitive. This makes sense — fewer tile types means decisions matter more.

### Phase 1.5 plan (priority-ordered, all triggered by A.5d data)

1. **Cap-extension experiment on the 5 highest-spread cells.** Re-run `k1_9x8_steep_pool8/12`, `k1_7x6_steep_pool8/12`, `k1_9x8_default_pool8` with cap=100 and cap=200, 50 paired games each, all 3 strategies. Cost: ~5 × 4 × 50 × 200ms = ~20 min. **The single most important Phase 1.5 experiment.** If d3-random spread grows materially with longer cap, the current 1.80-tier headline is an underestimate; if it saturates, 1.80 is the real answer.

2. **ruleK collapse investigation.** Add a unit test that exercises a length-3 chain with all-same extensions, verifies result differs at k=2 vs k=3 vs k=4. If it doesn't, file as a kernel-spec ambiguity (or bug) and surface to Evan. Confirm that the k>1 axis is truly redundant in this study before recommending ruleK as a Tier 1 design parameter.

3. **Tighter CIs on the 5 highest-spread cells.** 200 paired games each, all 3 strategies. Cost: ~5 × 4 × 200 × 200ms = ~80 min. Tightens CIs from ±0.19 to ±0.10 on the top spread numbers.

4. **Add d2 to the highest-headroom cells.** Top mastery-headroom cells (k1_6x5_flat_pool12 at 0.72 ± 0.32) deserve a finer ladder (random → d1 → d2 → d3) to see whether the headroom is monotonic or jagged. Cost: ~10 cells × 50 games × 100ms = ~5 min.

5. **Larger-board extension sweep.** Add 10×8, 12×10 boards at the highest-spread cell config (k=1, steep, pool=8). 4 × 50 × 200ms = ~3 min. Tests whether the board-size slope keeps rising or saturates.

Total Phase 1.5 cost estimate: **~110 minutes.** Well under a CPU-hour.

### What this means for retirement (Phase 4 design input — NOT a recommendation)

The bare kernel's skill curve is short. Total depth (Gap B) ≈ 1.8 tier; mastery headroom (Gap C) ≈ 0.35 tier. A typical-play (d1) ceiling is ~7-8 tier max, and skilled-play (d3) ceiling is ~7.5-8.5 tier max — that's `maxTile = 256` to `512` regions on default settings. Players plateau quickly.

Three implications for Phase 4:
- **Retirement (or some depth-multiplier mechanic) IS load-bearing** if the design wants a long skill curve. The bare kernel doesn't supply it.
- **The mechanism doesn't have to be bricking.** The bricking-as-retirement choice is principled (emerges from existing rules) but undocumented against alternatives. Now that we know the bare kernel has shallow depth, the question of *which depth-multiplier to use* opens up: bricking, modes, escalating cap, scoring rules, etc. Each deserves its own design exploration and study.
- **Phase 4 should not commit before that exploration.** The CLAUDE.md gate sequence puts Phase 3 (Tuning Console) before Phase 4 (Retirement); this study confirms that's the right order. Tuning Console first, then retirement-mechanism comparison, then Phase 4.

Whatever depth-multiplier ships, it should be studied with the same harness — the methodology in this study is reusable for "does retirement mechanism X deepen Gap C" questions.
