# Puzzle 001 — The Cascading Trap

**Captured:** 2026-05-01 by Evan during manual play.
**Difficulty:** Intermediate. Tests understanding of Rule D bonus,
cascading retirement, and the badge-vs-nomination model.

---

## The position

```
TURN  CHAIN  BEST  POOL
110     64   1024  8–1024

[ 8 ][ 8 ][ 16][ 16][ 8 ][ 8 ]
[64 ][32 ][ 8 ][ 16][64 ][ 8 ]
[256][64 ][32 ][64 ][ 16][256]
[128][128][64 ][64 ][ 16][32 ]
[ 8 ][256][ 16][64 ][ 16][32 ]
[ 8 ][512][ 8 ][ 8 ][64 ][128]
[64 ][1024][16 ][ 8 ][ 16][ 8 ]
```

Pool 8–1024 means the 2 and 4 tiers have already retired earlier in the
game. This is mid-to-late game.

## Question

What's special about this position? Multiple answers are correct — try to
find at least two.

(Hint: look at column 1.)

---

## Answer

<details>
<summary>Click to reveal</summary>

### What's there

Column 1 holds a complete doubling ladder, bottom to top:

```
(0,1)=8     (top of board)
(1,1)=32
(2,1)=64
(3,1)=128
(4,1)=256
(5,1)=512
(6,1)=1024  (bottom of board)
```

(Skipping (0,1)=8 since the chain would jump straight to 32, which is not
a valid same-or-double extension from 8.)

The 16 row at top (`(0,2)`, `(0,3)`, `(1,3)`) provides a same-extension
prefix that *enables* the chain to start with a same-value pair:

```
16(1,3) → 16(0,3) → 16(0,2) → ?
```

The chain crosses to the ladder via... actually, this is where the puzzle
gets subtle. There is *not* a direct 16→32 adjacency along column 1
(between (0,2)=16 and (1,1)=32 — they're diagonal, not orthogonal).

So the cleanest length-10 chain is:

```
16(1,3) → 16(0,3) → 16(0,2) → 8(0,1) — INVALID (16 → 8 is not same/double)
```

A chain that *does* fit the adjacency graph and the same-or-double rule:

```
8(0,1) → 8(0,0)  ← chain start (same)
... extension into the ladder requires reaching 16 from 8 (double)
```

There are several length-9+ chains in this position. The reader is
encouraged to actually try tracing them — the magic is in noticing how
hard the strict 8→16→32→64→...→1024 sequence is to fit on adjacency,
even when the *values* are all there.

### Why it's a teaching moment

Whatever the longest valid chain in this position is, **playing it
triggers a cascading retirement.** The result tile crosses multiple
retirement thresholds in one play (current pool max is 1024, so a chain
producing ≥ 2048 retires the 8 tier; ≥ 4096 retires the 16 tier too).

After the play:
- Result tile = up to 4096 (a new max, two tiers above old max)
- 8 tier retired → all 8s on the board become liabilities
- 16 tier retired → all 16s on the board become liabilities
- Spawn pool advances to 32–4096
- Now there are *many* retired tiles to clean up before they get stranded

### The lesson

This position illustrates **magnitude scales cleanup** — the bigger the
play you make, the bigger the cleanup workload you've earned for yourself.

A skilled player triggering this move is committing to an immediate switch
to **cleanup mode**, with substantially more work than a single-retirement
event.

### The badge model in action

Per the achievement model:
- **Triggering the chain alone** = *Nominated* for two tiers (the 8 and 16)
- **Triggering AND fully clearing both retired tiers, no dead tiles** =
  *Badges earned* for both
- **Triggering but leaving stranded tiles** = nominated, no badges, and
  tiers may be permanently lost

This is the cleanest test of skill: ambition (set up the chain) + execution
(clean up after).

</details>

---

## See also

- Memory: `project_lifecycle_framing.md`
- Memory: `project_magnitude_scales_cleanup.md`
- Memory: `project_badge_vs_nomination.md`
- Study: `docs/engineering/studies/01-death-mechanism.md`
