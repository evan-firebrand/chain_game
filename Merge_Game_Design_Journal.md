# Merge Game Design Journal

**Status:** Living document — process record
**Audience:** Designer (Evan), future-self auditing decisions
**Use case:** "Why did we choose X?" / "What did we consider and reject?" / "What should I revisit?"
**Updates:** Each time a design decision is discussed (settled or rejected)
**Last updated:** Phase 1 complete (Steps 1.1-1.5); ready for Phase 2

**Companion documents:**
- *Game Design Concepts & Frameworks* — vocabulary referenced throughout
- *Merge Game Specification* — current settled state of the design

---

## How to use this document

This is the **process record** — the meeting minutes of design conversations. It contains:

- **Phase-by-phase narrative** of decisions made, including alternatives considered
- **The kernel audit** against the six pillars of beloved games
- **Soft commitments** with revisit triggers
- **Things rejected** and why
- **Things deferred** with notes on when to revisit
- **Things to verify in playtest**

When auditing a past decision: find the relevant Phase/Step in the narrative, see the alternatives we considered and the rationale, then decide whether new information changes the answer. If you change a decision, update the *Specification* and add a note here explaining what changed and why.

The Specification is the contract; this Journal is the metadata about why the contract reads the way it does.

---

## Process framing

Our approach has been **iterative narrowing under explicit assumptions.** At each step:
1. Identify the open decision
2. State happy-path assumptions / defaults
3. Surface candidate options
4. Apply criteria + analysis
5. Pick (or defer with explicit reasoning)
6. Note what we'd revisit and under what conditions

We've kept commitments **soft** — ideas as working assumptions we proceed under, flag as revisitable, and revisit when new info arrives. This is a design philosophy, not just convenience: hard commitment too early locks out better ideas; refusal to commit at all prevents progress. Hold loosely, advance anyway.

## Phase 0 — Genre identification and concept definition

### How we got here

Started broad: "I want to learn about game design, theory, gamification." Narrowed through several rounds:

1. Identified three distinct fields; user wanted understanding of all three
2. User had specifically been thinking about a 2D number-merging game
3. Toured the canonical lineage of merge games (Threes!, 2048, Triple Town, Suika, Drop7)
4. User described his hybrid mechanic
5. Mechanic reflected back, novelty identified

### Concept summary (what user described)

> "The board is structured with columns and rows. Tiles are numbers. You start with 2,4,8,16,32,64,128,256. You merge numbers together by chaining them. You must start a chain off with 2 consecutive of the same number. And then you can either select the same number or to an adjacent tile (all directions including diagonal) where that number is doubled. Then when your chain is done, a resulting number is calculated and that becomes the last tile. Then tiles move down and new ones spawn. Your goal is to reach particular max tile levels without dying - when there are no moves left."

### What's novel about this concept

1. **Two-rule chain extension** (same OR doubled-adjacent) is a unique decision space combining match-3 (same-value) with 2048 (doubling) within path-traversal (chain).
2. **Wide starting spawn pool** (2-256) — most merge games start with everything as 2 or 4 and build up. Wide pool means players begin with messy boards and find elegant chains.
3. **Gravity + spawn cascading** after a chain creates Drop7-like opportunities for accidental follow-up chains.

The closest cousins are Threes!/2048, Two Dots, Drop7 — but no single existing polished game combines chain-by-adjacency + two extension rules + single-result-tile + column gravity. Real signature potential.

## Phase 1 — Pin down enough to prototype

### Step 1.1 — Archetype selection

**Decision:** Multi-mode game with kernel + knobs. **Endless** is the hero mode.

**User input:** Wanted a mix of cult favorite, mass casual, hardcore mastery, and cozy/chill. Explicitly excluded daily ritual.

**Resolution path:**

1. Recognized that user's mix is a *named pattern* — modal design. Examples: Tetris (marathon/sprint/ultra/battle), Slay the Spire (standard/ascension/daily/seeded), Hades (base + Pact of Punishment), Civilization (scenarios/difficulties/maps).
2. Introduced kernel-and-knobs framework: separate invariant (kernel) from variable (knobs) to support multiple modes elegantly.
3. Proposed mode-by-mode mapping:

| Mode | Archetype | Knob settings |
|---|---|---|
| **Endless** | Cult favorite | Default knobs, no time/move limit, death on, goal = max tile / score |
| **Levels** | Mass casual | Designed boards, objective stacks, move limits, star ratings, currency |
| **Ascension** | Hardcore mastery | Modifier-based runs (Slay the Spire model), daily seeded challenges |
| **Drift** | Cozy | Death off, slow spawns, soft visuals/audio, no score pressure |

4. Recommended Endless as hero mode because: (a) purest kernel expression, (b) cheapest to prototype, (c) all other modes are modifications of it.

**Counterpoint considered (and rejected):** Some designers argue you should prototype the *most-constrained* mode first (a single Levels-mode level) because constraints reveal mechanic weaknesses faster. We rejected this for our game — the mechanic needs to prove it sustains 30+ minutes of pure play before we know if it deserves levels at all.

**Rationale:** Endless validates the kernel; everything else is downstream.

**Status:** Soft commitment. Revisit if Endless prototype reveals fundamental mechanic problems that constraints (Levels-style) would have surfaced earlier.

### Step 1.2 — Result rule

The single most consequential open decision. Determines what kind of game this becomes.

#### Step 1.2a — Criteria for "good"

A result rule should ideally satisfy:

1. **Produces interesting decisions every move** — chain options have real tradeoffs (Sid Meier's bar)
2. **Stays in powers-of-2 system** — outputs are 2, 4, 8, 16, ... — no weird in-betweens
3. **Both extension types feel valuable** — same-value and doubled-adjacent each have strategic use
4. **Length rewarded proportionally, not exponentially** — long chains pay better but not so dramatically that "find longest" dominates
5. **Predictable in advance** — player can compute result while planning
6. **No dominant strategy** — no single chain pattern always wins
7. **Simple to state** — fits in a tweet ideally

Load-bearing criteria: #1 (interesting decisions), #2 (number system), #6 (no dominant strategy).

#### Step 1.2b — Tradeoffs analysis

Discussed the eight classes of tradeoffs in puzzle games and applied each to the merge game. Found that the chain mechanic produces a *particularly rich* tradeoff space — six or seven of the eight classes are alive in every move. *Climb vs Clear* is the central tradeoff (doubling extensions advance tier, same-value extensions free space). This was a strong sign of real depth in the kernel.

#### Step 1.2c — Stress-testing candidate rules

Defined nine test chains spanning meaningful cases:

| Label | Chain | Length | Doublings (d) | Same-value extensions (s) |
|---|---|---|---|---|
| T1 | 2,2 | 2 | 0 | 0 |
| T2 | 2,2,2,2 | 4 | 0 | 2 |
| T3 | 2,2,4,8 | 4 | 2 | 0 |
| T4 | 2,2,4,4,8 | 5 | 2 | 1 |
| T5 | 2,2,2,2,2,2,4,4,8 | 9 | 2 | 5 |
| T6 | 4,4,8,8,16,16,32 | 7 | 3 | 2 |
| T7 | 64,64,128 | 3 | 1 | 0 |
| T8a | 2,2,4 | 3 | 1 | 0 |
| T8b | 2,2,4,4 | 4 | 1 | 1 |

Initially considered 4 candidate rules, then proved Rule 2 = Rule 3 algebraically (under our chain mechanic, "every step doubles" and "doublings climb tiers, same-values multiply on top" are mathematically identical). Reduced to 3 meaningful rules:

- **Rule A** — last × 2
- **Rule B** — start × 2^(length−1)
- **Rule C** — tile follows Rule A; chain length earns separate score

| Test | Rule A | Rule B | Rule C (tile / score) |
|---|---|---|---|
| T1 | 4 | 4 | 4 / 2 |
| T2 | 4 | 16 | 4 / 4 |
| T3 | 16 | 16 | 16 / 4 |
| T4 | 16 | 32 | 16 / 5 |
| T5 | **16** | **512** | 16 / 9 |
| T6 | 64 | 256 | 64 / 7 |
| T7 | 256 | 256 | 256 / 3 |
| T8a | 8 | 8 | 8 / 3 |
| T8b | 8 | 16 | 8 / 4 |

Audit findings:

- **Rule A:** Strong on simplicity and decision integrity. Weak on "same-value extensions feel valuable" — they're bridges only, not directly rewarded. Long same-value chains (e.g., T2) are *strictly worse* than running multiple shorter chains.
- **Rule B:** Fails dominant strategy test. Length-hunting collapses the game — players hunt for longest chain regardless of composition. Doubling extensions become irrelevant (any extension equally good). Crazy values (T5 → 512) escape the chain's actual tile values. **Rejected.**
- **Rule C:** Strongest analytically — both tradeoffs alive on separate channels. But adds complexity (two reward channels, requires score to feel meaningful in every mode).

#### Step 1.2d — Designing Rule D family

User reaction: "I liked Rule B but the values were crazy." Diagnosed the issue: Rule B's *intent* is right (length should pay) but exponential growth is the bug.

Introduced **Rule D** — parameterized family where every k same-value extensions count as one extra doubling:

> result = start × 2^(d + ⌊s / k⌋ + 1)

Equivalently: result = last × 2 × 2^⌊s/k⌋

Parameter k is the knob:
- k = ∞: Rule A (same-values worthless for tile)
- k = 4: every 4 same-values = 1 bonus doubling. Subtle.
- k = 3: every 3 same-values = 1 bonus doubling. Modest.
- k = 2: every 2 same-values = 1 bonus doubling. Strong.
- k = 1: Rule B (same-values = full doubling each)

Comparison on test chains for k=2 and k=3:

| Test | Rule A | Rule B | D, k=3 | D, k=2 |
|---|---|---|---|---|
| T2 | 4 | 16 | 4 | 8 |
| T4 | 16 | 32 | 16 | 16 |
| T5 | 16 | 512 | 32 | 64 |
| T6 | 64 | 256 | 64 | 128 |
| T8b | 8 | 16 | 8 | 8 |

#### Decision: Rule D with k = 2

**Rationale:**
- Honors user's instinct that length should pay aggressively
- Bounded math (T5 → 64, not 512)
- Doublings remain the strongest single move (each = full extra tier)
- Same-value extensions valuable in *pairs* (every two = one extra tier)
- Single isolated same-value extensions are essentially "free" but don't directly pay (still useful as bridges)
- Long same-value runs become genuinely rewarding

**Alternatives considered:**

| Alternative | Why not chosen |
|---|---|
| Rule A | Same-value extensions feel wasted; T2 problem |
| Rule B | Dominant strategy (length-hunting); crazy values |
| Rule C | Adds dual-currency complexity; max tile = score in user's framing |
| Rule D, k = 3 | More conservative; might feel stingy on same-values |
| Bonus content for long chains | More content-design than rule design; can be added later as Layer 2 |
| Soft retirement | Considered but the mechanic's discreteness preferred for clarity |

**Status:** Soft commitment. Will watch in playtest:
- If players over-index on hunting long chains → ratchet toward k = 3
- If long chains feel under-rewarded → consider k = 1.5 (every 1.5 same-values, requires non-integer math) or stay with k = 2 plus content bonuses

**Important property to preserve:** Result rule should NOT vary between modes — that breaks game identity.

### Step 1.3 — Default grid size

**Decision:** 6 columns × 7 rows = 42 cells, portrait orientation.

**Reference points considered:**

| Game | Grid |
|---|---|
| 2048 / Threes! | 4×4 |
| Triple Town | 6×6 |
| Drop7 | 7×7 |
| Bejeweled | 8×8 |
| Candy Crush | ~9×9 |

**Rationale:**
- 4×4 too tight — chains of 5-9 wouldn't have room
- 5×5 borderline — heavily constrains paths
- 6×7 sweet spot — enough room for ambitious chains, scannable in one glance
- 7×7+ starts sprawling; mental scan load increases
- Portrait orientation: gravity drops top-to-bottom, mobile screens are taller than wide, gives reservoir for chain development

**Knob range across modes:** ~5×6 (tight, Ascension challenges) to ~7×8 (loose, Drift cozy).

**Status:** Confirmed. Will revisit if playtest shows specific scaling problems.

### Step 1.4 — Spawn distribution (initial decision, then revised)

#### Initial decision

**Pool:** 2-256 (user's stated values)
**Weights:** 1/value (power-law decay) — each tier half as likely as previous
**Rate:** L−1 new tiles after each chain of length L (proportional to chain length, an emergent pacing property)
**Position:** Top of empty columns after gravity
**Evolution:** Static (revisit later)

Concrete weights:

| Value | Weight | Probability |
|---|---|---|
| 2 | 0.5 | ~50% |
| 4 | 0.25 | ~25% |
| 8 | 0.125 | ~13% |
| 16 | 0.0625 | ~6% |
| 32 | 0.031 | ~3% |
| 64 | 0.016 | ~2% |
| 128 | 0.008 | ~1% |
| 256 | 0.004 | ~0.4% |

Expected board composition on full 42-cell grid: ~21 cells of 2, ~10-11 of 4, ~5 of 8, ~3 of 16, ~1 of 32, occasional 64s, rare 128s and 256s.

**Alternatives considered:**

| Alternative | Why not initially chosen |
|---|---|
| Uniform across 2-256 | Adjacent same-value pairs become rare; chain starts dry up |
| Bottom-only (2/4/8 only) | Would simplify but doesn't honor stated 2-256 pool |
| Steeper power-law (1/value²) | Higher tiles too rare to feel like real spawns |
| Dynamic Threes!-style unlock | More complex, but flagged as future option |

#### Revision (introduced by user): tile retirement mechanic

User proposed: **when player reaches a new max tile, the lowest-tier value in spawn pool retires permanently.** Existing instances on board remain until cleared.

**Why this is a strong design move:**

1. **Solves spawn pool drift** — keeps spawn pool focused on relevant range as player climbs
2. **Solves late-game flatness** — boards don't become cluttered with every value ever
3. **Couples micro and meta gameplay** — chain decisions affect strategic readiness for upcoming progression
4. **Creates new strategic axis: anticipating progression** — before reaching a new max tile, player asks "are soon-to-be-retired tiles in chainable clusters or stranded?"
5. **Synergies with Rule D, k=2** — incentivizes long same-value chains right before milestones, exactly what Rule D rewards

**Strategic implications:**

- **Stranding becomes a slow-poison failure mode.** Stranded retired tiles consume cells permanently, shrinking effective board size, raising death pressure over time.
- **Pre-milestone behavior emerges.** Predictable rhythm: chain freely → approach milestone → tidy up → push through → recover → repeat. This cadence is exactly the meta-pacing pattern of great cult-favorite games.
- **Spawn distribution becomes dynamic by design.** The static 1/value plan becomes a *staged* system: weights still ~1/value, but the *pool itself* shifts as retirement fires.

#### Step 1.4 final design (settled)

After working through the open design questions, the finalized retirement spec is:

**Trigger model — "next tier above current spawn ceiling"**

- Initial spawn pool: 2-256 (ceiling = 256, eight tiers)
- First retirement fires when player reaches **512** (next tier above 256). 512 is the first major goal.
- At that moment: 2s retire, sliding window slides — pool becomes 4-512
- Next retirement fires when player reaches 1024 → 4s retire, pool becomes 8-1024
- Etc. Pool always stays 8 tiers wide.

**Why this trigger model (chosen over fixed multiplier rules like 8×):**

1. First retirement is a real milestone — reaching 512 takes meaningful play (likely 50+ chains)
2. Retirement fires at the moment of "graduation" — reaching above the spawn ceiling is itself a player achievement
3. No explicit grace period mechanic needed — entire pre-512 game IS the implicit grace
4. Self-pacing — the trigger moves with the player, naturally skill-correlated
5. Generalizes cleanly to higher tiers — each retirement fires at "next tier above ceiling"
6. Honors the user's instinct that "first max tile takes them a few turns"

Rejected: 4× / 8× / 16× fixed multiplier triggers (too aggressive at low tiers; arbitrary timing).
Rejected: Fixed move count triggers (decouples retirement from skill — wrong frame).

**Retirement type — hard**

When a tier retires, it never spawns again. No soft retirement (continued rare spawns) — would dilute the mechanic.

**Pool size dynamics — sliding window, 8 tiers wide**

Pool always maintains 8 distinct tiers. As bottom retires, new top tier joins at low frequency (the new tier becomes the rarest in the spawn pool, replacing the previous rarest's role).

Why 8 tiers (not 4 or 5): more variety throughout play, more enjoyable. The spawn algorithm (1/value weighting) does the difficulty work, not the pool size.

**Stranded tile fate — stay as normal tiles (emergent blockers)**

Retired tiles stay on the board, behave by normal chain rules. *No special handling needed.*

The stranding-as-blocker behavior emerges automatically:
- Two adjacent retired tiles: still chainable (start a chain with them as normal)
- One isolated retired tile: cannot be cleared. Why? Chain start requires two adjacent same-values (no new ones spawn). And no chain can extend *to* a lower-tier retired tile from a higher tile (extension rule is "same OR doubled" — a 4 can't extend to a 2 because 2 is half, not double).
- Result: isolated retired tiles effectively become permanent blockers, but it's emergent from existing rules rather than a special-case mechanic.

The grace period is the player's window to *avoid* stranding by chaining through low-tier tiles before they retire.

**No explicit grace period UX (yet)**

The mechanic doesn't need an explicit warning state in the kernel — the entire pre-threshold game is the implicit grace. We can layer explicit grace UX on top later if playtest shows players are surprised by retirements.

**Per-mode availability**

| Mode | Retirement state |
|---|---|
| Endless | On (default trigger model) |
| Drift (cozy) | Off — cozy shouldn't strand |
| Ascension | On, possibly intensified (modifier could shorten grace, or use 4× trigger) |
| Levels | Overridden by designed boards (level designer controls state) |

**Status:** Settled. All sub-decisions confirmed.

**Honest cost of adopting:**
- Increased prototype complexity (track max tile, spawn ceiling, sliding window state)
- Tuning surface area grows (weights at each stage, not just initial)
- Harder to remove later than to add later

**Build sequencing:** Tile retirement is part of v1.5, not v1. The bare chain mechanic (without retirement) is v1, which validates the kernel before we add the retirement layer.

### Step 1.5 — Kernel audit against six pillars (COMPLETED)

**Purpose:** Walk through each of the six pillars of beloved games (see Concepts §5) and audit the current kernel against each. Identify weaknesses to address either now (mechanic tweak), in v1.5+ (content/juice work), or accept and watch in playtest. Audit happens *before* prototype because mechanic-level fixes are much cheaper now than after the prototype is built.

#### Pillar 1 — Depth that reveals slowly

*Strengths.* The chain mechanic activates 6-7 of the 8 named tradeoff classes simultaneously — that's structurally rare. Same-value extensions as path bridges is a non-obvious insight that takes 20-50 games to internalize. Rule D, k=2 creates real strategic distinction between climbing chains, clearing chains, and bridging chains. Retirement adds a meta-strategic layer that compounds with chain-decisions.

*Weaknesses.* Without retirement (v1), the game may feel "samey" after 30-60 minutes — retirement is the meta-rhythm. Powers-of-2 progression is well-trodden ground; players will arrive with mental models from 2048.

**Verdict:** Strong (with v1.5 retirement layer). Adequate for v1 alone.

**Action items:**
- Watch in v1 playtest: does the bare chain mechanic stay fresh for 30+ minutes?
- Confirmed v1.5 priorities: retirement is the depth multiplier, not a polish feature

#### Pillar 2 — Interesting decisions every move

*Strengths.* Non-trivial boards typically offer 3-5 plausible chain starts. Once started, every extension is a real choice. Chain placement matters because the result tile lands at the last position. Stranding risk adds pressure.

*Weaknesses.* In sparse early-game boards, choices may collapse to 1-2 forced chains. In late game with heavy stranding, the board may lock into limited options. The "must start with adjacent same-value pair" requirement creates moments where the only chain is forced.

**Verdict:** Strong in mid-game; Watch for early-game and locked-board states.

**Action items:**
- Watch in playtest: are there sustained periods where chains feel forced?
- If forced-chain states are common: consider tweaking spawn distribution to ensure adjacent same-value pairs always exist

#### Pillar 3 — Failure that teaches

*Strengths.* Loss condition is concrete and visible — "no two adjacent same-value tiles" — and the player can see this on the death board. Stranding-from-retirement creates clear failure narratives. Chain-finding is a teachable skill.

*Weaknesses.* Without explicit UX, surprise retirement events feel arbitrary. RNG-related deaths could feel "unfair." Players might not understand *why* a particular chain choice was suboptimal.

**Verdict:** Adequate for v1; needs work in v1.5+ for retirement.

**Action items:**
- v1.5 priority: visual feedback when retirement is approaching (highlight retiring tiles, "tier graduated" moment)
- v1.5 priority: visual treatment of the death state (clearly show why no chain is possible)
- v2+ idea: post-game replay or "what you missed" hints
- Watch in playtest: are deaths feeling fair or arbitrary?

#### Pillar 4 — Felt mastery curve

*Strengths.* Multiple distinct skill axes — chain length, climb-vs-clear judgment, board management, retirement timing. Each has clear improvement trajectory. Skills transfer between games. Max tile reached is a natural personal record.

*Weaknesses.* Without recorded stats, players can't see improvement objectively. Without comparisons (personal best, leaderboards), mastery is purely internal feeling.

**Verdict:** Adequate for v1; needs explicit reinforcement in v2+.

**Action items:**
- v1: track current-game stats (max tile, chains made, longest chain) — no persistence needed
- v2+ priority: persistent stats tracking (lifetime best max tile, longest chain ever, total games played)
- v3+ idea: achievements (first 1024, longest chain, etc.)
- Accept for v1: purely internal mastery feel is fine for first prototype

#### Pillar 5 — Aesthetic identity

*Strengths.* The chain mechanic offers strong visual potential — animated chain paths, dramatic doubling moments, retirement set-pieces. The "next tier above ceiling" milestone (first time = 512) is a clear narrative moment.

*Weaknesses.* **Biggest current gap.** No aesthetic identity yet — explicitly deferred to v2.5. Risk: a generic implementation looks like "2048 variant" forever. Without distinctive visuals/audio, the chain mechanic's novelty is invisible to anyone who doesn't already understand the rules.

**Verdict:** Deferred — biggest known gap. Acceptable for v1 (placeholder visuals), but must be addressed seriously in v2.5.

**Action items:**
- v1: use intentionally minimal/placeholder visuals (don't fake polish — fake polish hides what needs work)
- v2.5: significant design work required. Possible directions to explore:
  - Mechanical/kinetic aesthetic (numbers as physical objects)
  - Themed numbers (real-world objects matching tier values)
  - Abstract geometric (Threes!-style minimalist)
  - Generative/mathematical art aesthetic
- Note: aesthetic identity directly influences which archetype the game lands as — cult favorites have intense aesthetics

#### Pillar 6 — Honest reward structure

*Strengths.* Rule D, k=2 ensures result tiles correlate strongly with chain quality. Power-law spawn weights ensure low-tier tiles dominate, keeping chain starts available. Death state is skill-correlated. Chain mechanic is purely cognitive.

*Weaknesses.* Spawn variance could theoretically punish skilled play in edge cases. Retirement timing has some luck dependency in early game. Rare high-tile spawns could distort early-game strategy.

**Verdict:** Strong. RNG bounded by skill; luck contributes but doesn't dominate.

**Action items:**
- Watch in playtest: are bad-luck losses common enough to feel arbitrary?
- v3+ option: seeded daily challenge (Ascension mode) for deterministic skill comparison

#### Audit summary

| Pillar | v1 verdict | Biggest gap |
|---|---|---|
| 1. Depth that reveals slowly | Adequate (Strong with retirement) | Need v1.5 retirement to hit "strong" |
| 2. Interesting decisions every move | Strong | Watch for forced-chain edge cases |
| 3. Failure that teaches | Adequate | Need retirement UX in v1.5 |
| 4. Felt mastery curve | Adequate | Need persistent stats in v2+ |
| 5. Aesthetic identity | **Deferred** | **Biggest known gap** — must address in v2.5 |
| 6. Honest reward structure | Strong | Watch RNG variance in playtest |

**Overall:** The kernel is structurally sound and ready to prototype. No fundamental mechanic changes needed. The two biggest gaps are explicit (aesthetic deferred to v2.5; mastery feedback deferred to v2+) — both deferred deliberately.

**Three priority callouts:**

1. **The bare chain mechanic must hold for 30+ minutes alone in v1 playtest.** If it doesn't, no retirement layer or content will save it. The audit suggests it should — but this is the single load-bearing assumption.
2. **Aesthetic identity work in v2.5 is critical, not cosmetic.** A generic implementation will be perpetually compared to 2048.
3. **Retirement UX in v1.5 needs careful design.** The mechanic is rich but invisible without proper visual treatment.

**Phase 1 status:** Complete. Ready to move to Phase 2 (Build and play).

## Phase 2 — Build and play (next phase)

Confirmed: **only Endless mode is built for v1.** Hero mode validates kernel; other modes are spec'd but deferred.

The full staged build roadmap lives in the *Specification* document. Quick summary here for journal context:

| Stage | What's in it | Goal |
|---|---|---|
| **v1** | Bare chain Endless: grid + tiles + chain rule + Rule D k=2 + 1/value spawning, no retirement, no special tiles | Does the chain mechanic feel fun for 30+ minutes? |
| **v1.5** | Add tile retirement (next-tier-above-ceiling trigger, sliding window, stay-as-tiles) | Does retirement add depth or noise? |
| **v2** | Add Layer 2 content (special tiles, wilds, blockers, multipliers) | Does content deepen the game without distorting it? |
| **v2.5** | Add juice and aesthetic identity | Does it become a *thing*? |
| **v3+** | Add Levels mode (objectives, level design, currency) | Does the kernel survive content-driven progression? |
| **v4+** | Add Ascension mode (modifiers, daily challenges) | Does the kernel hold under modifier extremes? |
| **v5+** | Add Drift mode (cozy parameters, retirement off, soft visuals) | Does the kernel work as a cozy experience? |

Each stage is a **gate**: do not proceed if the prior stage didn't land.

### Phase 2 sub-steps (for v1 specifically)

- 2.1 Consult UX/UI lens before any visual work
- 2.2 Prototype bare core mechanic (no retirement, no content elements yet)
- 2.3 Play it. Decide if it's fun *before* adding anything

## Phase 3 — Iterate or layer up (DEFERRED)

- 3.1 If mechanic isn't fun: tune mechanic. *Do not add content to fix a broken mechanic.*
- 3.2 If mechanic is fun: proceed to v1.5 (add retirement)
- 3.3 Continue staged rollout per build roadmap above

---


---

# AUDIT AND REVISIT NOTES

This section captures the *living watchlist* — soft commitments with revisit triggers, things considered and rejected, things deliberately deferred, things to verify in playtest, and things explicitly out of scope. Update as decisions are made or revisited.

## Decisions explicitly held as soft commitments

| Decision | Revisit if |
|---|---|
| Result rule = Rule D, k=2 | Playtest shows length-hunting dominates → consider k=3 |
| 6×7 portrait grid | Playtest shows scaling problems |
| Spawn weights = 1/value | Stages feel imbalanced under retirement |
| 8-tier spawn pool size | Variety feels overwhelming or insufficient |
| Endless as hero mode | Bare prototype reveals fundamental mechanic problems |
| Hard retirement | Stranding feels too punishing in playtest |
| Trigger = next tier above ceiling | First retirement at 512 feels too late or too early |
| No explicit grace period UX | Players are surprised by retirements (would suggest adding warning state) |
| Stranded tiles stay as normal tiles | Permanent blockers feel arbitrary or unfair (would suggest auto-clear or convert-to-special) |

## Things considered and rejected

| Rejected | Why |
|---|---|
| Rule B (start × 2^L−1) | Dominant strategy (length-hunting collapses game); crazy values escape chain's tile values |
| Daily ritual archetype | User explicitly excluded |
| Uniform spawn distribution across 2-256 | Adjacent same-value pairs too rare; chain starts dry up |
| Same-value extensions count as full doublings (Rule B disguised) | Same problem as Rule B |
| Prototype most-constrained mode (Levels) first | Bare mechanic must prove itself before constraints are added |
| Auto-clearing stranded retired tiles | Would collapse the strategic axis retirement creates |
| Fixed-multiplier retirement triggers (4× / 8× / 16×) | Too aggressive at low tiers; arbitrary timing decoupled from player progression |
| Move-count-based retirement triggers | Decouples retirement from skill — wrong frame for our game |
| Soft retirement (continued rare spawns of retired tier) | Would dilute the mechanic's clarity |
| 4-tier narrow spawn pool | Less variety, less enjoyable; algorithm should do difficulty work, not pool size |
| Prototyping multiple modes simultaneously in v1 | Wastes effort if kernel turns out broken; modes are modifications of validated Endless |

## Things deliberately deferred (with note on when to revisit)

| Deferred | When to revisit |
|---|---|
| Layer 2 content design | After Endless v1 plays well for 30+ minutes |
| Specific Levels content | After Layer 2 element library exists |
| Ascension modifier system | After Endless and Levels both function |
| Drift parameters | When ready to expand mode roster |
| Score system beyond max-tile | After playtest reveals whether length-bonus is needed |
| Game feel / juice | After core mechanic validated as fun |
| Aesthetic identity | After mechanic is settled enough that visuals can support it |

## Things to verify in playtest

**v1 (bare chain Endless) — verify before adding retirement:**
- Whether Rule D, k=2 produces interesting decisions throughout a 30-minute session
- Whether long same-value chains feel rewarded or "wasted" relative to short doubling chains
- Whether 6×7 grid feels too tight, just right, or too sprawling
- Whether spawn weights produce enough chain starts without making the game trivial
- Whether the loss condition (no adjacent same-value pair) creates fair deaths or arbitrary ones
- Whether 8 active tiers feels enjoyable or overwhelming

**v1.5 (retirement layered in) — verify after adding retirement:**
- Whether reaching 512 takes "a few turns" of meaningful play (not too fast, not too slow)
- Whether stranding creates good strategic tension or bad frustration
- Whether the milestone-rhythm pacing is satisfying
- Whether players notice and adapt to incoming retirements without explicit UX
- Whether 8-tier sliding-window pool stays varied as the game progresses

## Things explicitly NOT in scope yet

- Monetization model — entire question deferred until we know what game we have
- Platform decision (web/iOS/Android/native) — currently planning web prototype but final platform open
- Multiplayer / social — not part of any current mode
- Narrative or character — not part of any current mode
- Live ops / content pipeline — only relevant once at scale

---

*End of document. Living document — update as decisions are made or revisited.*

---

*End of Design Journal. Companion to the Specification (which captures current settled state).*
