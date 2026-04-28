# Brainstorm Swarm Results

*8 agents run in parallel (A1–A8), followed by synthesis (A9). 2026-04-28.*

---

## SYNTHESIS (A9)

---

### 1. Cluster Map

**Cluster A: "Resonance" / Hidden Tile State**
Agents: A1 (Orphan Pressure Map), A2 (Resonance Chains), A5 (Resonance Chains Fork), A6 (Resonance Tiles)
The word "resonance" appears independently in A2, A5, and A6 with different mechanics but the same underlying idea: tiles accumulate hidden state through board activity that modifies chain results. A1's Orphan Pressure Map is the information-only cousin. **Convergence signal:** four agents from different design lenses reached for the same concept (tiles with memory) as the primary depth lever. This is the strongest convergence in the set.

**Cluster B: "Echo" / Chain History as Persistent Visual Layer**
Agents: A2 (Chain Echo), A3 (Echo Trails), A5 (Echo Tiles), A6 (Echo Chains), A7 (Route Memory)
Five agents independently proposed some form of chain-path persistence — either mechanical (A2, A5, A6) or purely visual (A3, A7). The mechanical versions diverge significantly (compounding s-value vs. double-on-use vs. echo window), but the visual ones (A3 trails, A7 transit lines) are nearly identical. **Convergence signal:** chain history as a readable artifact is the single most cross-agent idea in the set. The game currently discards all path information on resolve — agents across every domain flagged this as a loss.

**Cluster C: "Fault Lines" / Named Board Hazard**
Agents: A2 (Fault Lines), A5 (Fault Lines), A6 (Fault Lines)
Three agents proposed "fault lines" by name. A2's version is invisible and shifts; A5's creates hanging tiles; A6's creates cracked tiles that cascade. All three share: a persistent board feature dividing the grid that creates routing decisions. **Convergence signal:** agents independently sensed the 6×7 board is too uniform — it needs structural asymmetry beyond tile values. The fault line concept is the dominant answer.

**Cluster D: Retirement Legibility / Milestone Ceremony**
Agents: A1 (Retirement Countdown), A4 (Retirement Ledger), A7 (Tile Retirement Ledger)
Three agents — from Into the Breach, Hades, and Mini Metro lenses — proposed making retirement milestones legible and ceremonial. A1 focuses on countdown-to-event; A4 and A7 both propose a persistent ledger. **Convergence signal:** retirement is a designed milestone that currently lands as a surprise. Agents across optimizer, achiever, and meta-progression lenses all flagged the same gap.

**Cluster E: Audio-Visual Tile Identity**
Agents: A3 (Harmonic Audio Synthesis), A8 (Tier Voice Registers)
Two agents independently proposed assigning musical pitches to tile values on a harmonic scale, with chain-building producing real-time melodic phrases. The implementations are nearly identical. **Convergence signal:** the strongest single aesthetic identity proposal appears independently from two different agents. High implementation confidence.

**Cluster F: Chain Path as Physical/Visual Object**
Agents: A3 (Echo Trails), A7 (Route Memory), A8 (Chain Path Ink Trail)
Three agents proposed giving the chain path material presence beyond a selection highlight. **Convergence signal:** the current chain path is experienced as temporary and weightless. Agents from artist, economy, and feel lenses all independently reached for "make the path a thing."

---

### 2. Top 10 Ideas

Ranked by (novelty × pillar alignment), with extra weight on aesthetic identity (biggest current gap).

**#1 — Chain Path Ink Trail (A8)** | Gate: v1.5
The chain path renders as an animated ink stroke with material properties: thickness, ink-bleed, hue-ramp by result value, contraction on commit, cracking on abandon. Directly addresses aesthetic identity with a concrete visual language that encodes mechanical information (chain value) in the material itself. Making the act of building a chain feel like drawing.

**#2 — Harmonic Audio Synthesis / Tier Voice Registers (A3 + A8 — convergent)** | Gate: v2
Tile values map to instrument tiers on a pentatonic scale; chain-building composes a live melodic phrase; completion plays a chord bloom. Most validated aesthetic identity proposal in the set (two independent arrivals). Addresses two pillars simultaneously: aesthetic identity and felt mastery (players recognize tile values by ear before reading the number).

**#3 — Breath Board (A3)** | Gate: v1.5
The board animates with idle breathing: tiles pulse at phase-offset rates, higher-value tiles pulse slower, a haze drifts between high-value neighbors. Touch snaps everything to stillness; release exhales. The only idea addressing the board's feel between moves — the ~80% of elapsed time when the player is planning.

**#4 — Tile Face Aging (A8)** | Gate: v2
Tiles carry two-dot eyes expressing lifecycle: wide-open (fresh), heavy-lidded (3+ turns old), closed (orphaned/retired). Eyes track drag direction during chain-building; result tile blinks open on creation. Most conceptually distinct aesthetic identity proposal — tiles become characters with felt lifecycles. The orphan state is load-bearing: closed eyes makes retirement inertness immediately readable without a UI label.

**#5 — Color Temperature Gradient (A3)** | Gate: v1.5
Tile color follows a designed thermal gradient: deep ocean blue-teal (low values) → amber-gold (mid) → white-violet (high). Retired tiles render desaturated grey. Board average color temperature shifts as player progresses — early game cold, late game burning. Solves aesthetic identity at the foundational level; all other visual ideas build on a strong color base.

**#6 — Retirement Countdown (A1)** | Gate: v1.5
A numeric counter on the current-lowest tier tiles showing estimated spawns before next retirement. Transforms retirement from a surprise event into a planning horizon — the optimizer starts stockpiling higher-tier pairs before the tier disappears. Convergent with A4 and A7 (Cluster D), validating the gap.

**#7 — Orphan Cascade (A5)** | Gate: v1.5
Retired orphan tiles gain a lifecycle: placed → cracked (sandwiched by chain tiles) → wild for one chain → shattered. Orphans become ticking dramatic resources rather than inert blockers. The only idea making the retirement mechanic's byproduct exciting rather than depressing.

**#8 — Chain Commit Freeze Frame (A8)** | Gate: v1
At chain commit, 120ms freeze: path flashes white, result value appears large. Then tiles vanish along path in sequence (30ms/tile, particle burst per tier color). Result tile materializes last (~400ms total). Simplest implementation in the top 10, improves every session regardless of skill level, directly addresses "failure that teaches."

**#9 — Epitaphs (A4)** | Gate: v1.5
Run-end generates a one-line epitaph from actual run data ("Held the board together for 43 moves. Never touched a 256."). Saved to a scrollable graveyard. Reframes loss as a completed story and accumulates into a personal record. Highest-novelty "failure that teaches" entry.

**#10 — Gravity Scar (A5)** | Gate: v2
Chains of length 6+ mark their result column as a scar for 3 turns; scarred columns spawn tiles one tier higher. Scars are visible. Long chains in a column accelerate local inflation — double-edged reward that makes column choice carry medium-term consequence. Most targeted at "interesting decisions every move" through spatial commitment.

---

### 3. Outliers Worth Examining

**Adjacency Shadow (A2)**
Each tile has a hidden directional "shadow" based on spawn origin (column-gravity vs. chain-result placement). Aligned-shadow chain starts double the result. The axis is readable only from a 1-pixel gradient on the tile edge. The only idea in the set where visual language is mechanically load-bearing — reading the art correctly gives a gameplay advantage. Direct implementation of the Baba Is You principle ("visual grammar encodes rule grammar"). Has no analogue in any other agent's output. The 1-pixel risk is an implementation constraint, not a design flaw — a slightly larger indicator could preserve "hidden in plain sight" quality. High novelty, unvalidated, worth a prototype.

**Inheritance System (A4)**
At run end, the player chooses one inheritance: a single tile (their run's highest value, capped) placed at a fixed board position at the next run's start. Visually distinct. No other agent proposed any form of cross-run mechanical persistence. Structurally different from meta-progression (not a permanent upgrade) and from roguelike boons (it's your own achievement, not a random gift). Creates genuine run-to-run continuity without power escalation; makes the end-of-run moment matter. The risk (trivializing early tension) is manageable with placement constraints (e.g., always spawns top row, center).

**Network Map (A7)**
Between sessions, a persistent "system map" shows lifetime play as a growing transit network — each session adds a station dot connected by a line whose color and thickness encodes that session's score. After 50 sessions, the player has a dense personal map. The only idea addressing the multi-month player relationship rather than the single session. An identity object: the player's game becomes a map uniquely theirs. No other agent reached for this. Conceptually distinct from all 39 other ideas.

---

### 4. Combination Moves

**Move 1: Color Temperature Gradient (A3) + Chain Path Ink Trail (A8)**
The ink trail's hue ramp (low=amber, mid=rose, high=violet) is currently defined independently of the board's color system. If Color Temperature Gradient is the foundational system, the ink trail's hue ramp should *derive* from it — the chain path's color is literally made from the tiles it consumed. A long high-value chain leaves a white-violet scar against a warm board. A low-value chain leaves an amber scratch. The board's color field and the chain's color language become one unified system. Neither achieves this unification alone.
*Dependency: Color Temperature must be specified first; Ink Trail's palette derives from it.*

**Move 2: Harmonic Audio Synthesis + Chain Commit Freeze Frame (A8)**
The freeze frame has particle bursts in tier colors during the tile-vanish sequence. If each vanishing tile also plays its note during the sequence (not during drag, but during resolve), the chain "replays" as a melodic phrase at the commit moment — the player hears the chain they built in the order they built it, while watching tiles disappear in that order. The freeze frame is bearable at 400ms when it is also a satisfying sound event; the audio becomes diegetically justified rather than decorative.
*Dependency: none — both are additive; the resolve-sequence timing in Freeze Frame provides natural sync points for the audio.*

**Move 3: Retirement Countdown (A1) + Orphan Cascade (A5)**
Retirement Countdown makes approaching tile retirement a planning horizon. Orphan Cascade makes the byproduct of retirement (orphan blockers) into a dramatic resource. These close a loop: the countdown tells you retirement is coming, so you plan; retirement fires and orphans appear; Cascade tells you orphans are not just losses — they are cracked wilds waiting to be used. Without the countdown, orphan exploitation is reactive. Without the cascade, the countdown creates dread with no productive outlet. Together they convert retirement from a surprise loss into a managed transition with strategic depth on both sides of the milestone.
*Dependency: both require v1.5 retirement system; Countdown should ship first.*

---

### 5. Constraint Violations

**Resonance Chains Fork (A5, Idea 2)** — *Rule D / one-chain-per-turn violation*
Describes two separate chains resolving in the same turn via a "fork." Current rules allow one chain per turn. This requires either modifying Rule D or adding a parallel-chain mechanic. Flagged pending clarification on whether fork resolves under the existing formula.

**Chain Echo (A2, Idea 2)** — *Rule D tampering*
"The echo length adds to the new chain's s-value before calculation begins — compounding across generations." Injecting inherited s-values from prior chains into the s variable modifies how the formula is applied. The s-value is meant to represent the current chain's length, not an accumulated cross-turn value. Rule D tamper confirmed.

**Line Gauge / Extension Token (A7, Idea 2)** — *Adjacency constraint violation*
"Tokens let the player add one free tile to any legal chain mid-draw." Adding a free tile mid-chain need not be adjacent, violating the core adjacency rule. Flagged.

**Tier Bridges (A6, Idea 5)** — *Rule D tampering*
"A bridge tile counts as matching with the tier below its actual value." This means a tile can extend to a tile with half its value — the reverse of the doubling direction. Inverts the chain extension rule. Flagged.

---

### 6. Aesthetic Identity Shortlist

Ranked by how directly and concretely each idea gives this game a recognizable identity it currently lacks:

| Rank | Idea | Agent | Why |
|---|---|---|---|
| 1 | Color Temperature Gradient | A3 | Operates at the foundation — the color system for all tiles, all sessions, all screenshots |
| 2 | Chain Path Ink Trail | A8 | Transforms the primary interaction into a drawing act — the interaction identity |
| 3 | Harmonic Audio Synthesis / Tier Voice Registers | A3/A8 | Only idea addressing identity in a non-visual channel — the audio complement to Color Temperature |
| 4 | Tile Face Aging | A8 | Most emotionally distinctive — tiles are alive, aging, dying. No other merge puzzle does this |
| 5 | Breath Board | A3 | Covers the 80% of session time that no other idea touches — planning-phase identity |
| 6 | Echo Trails | A3 | Board-as-palimpsest — session history made visible. Complements Ink Trail (live gesture vs. record) |
| 7 | Adjacency Shadow | A2 | Only idea where visual language is mechanically load-bearing — the art IS the rule |
| 8 | Liquid Merge | A3 | Strong physical metaphor (merge = gravity) but expensive to implement on mobile |

---

## RAW AGENT OUTPUTS

---

### A1 — The Optimizer (Into the Breach)

**Idea 1: Chain Forecast Overlay**
- What it is: A toggleable HUD layer that highlights, for every legal chain start on the board, the maximum achievable result given optimal extension — displayed as a color-coded heat map directly on the tiles. Tapping a tile shows the specific path that achieves the ceiling.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2
- Risk: Removes discovery phase for new players if not gated.

**Idea 2: Efficiency Rating Per Chain**
- What it is: After each chain resolves, display tiles consumed vs. result produced as a ratio (e.g., "4 tiles → 128 | 32/tile"). Track session-wide efficiency average. No score bonus — pure information.
- Pillar served: Felt mastery curve
- Implementation gate: v1.5
- Risk: Short 2-tile chains with double extension produce misleading "high efficiency" numbers.

**Idea 3: Orphan Pressure Map**
- What it is: Column-danger indicators — a thin bar at each column bottom that fills as orphan density increases. Purely a legibility tool.
- Pillar served: Interesting decisions every move
- Implementation gate: v1.5
- Risk: Adds visual noise to an already information-dense board.

**Idea 4: Theoretical Maximum Tracker**
- What it is: A persistent "Board Ceiling" stat computed each turn as the sum of maximum achievable results across all non-overlapping optimal chains on the current board. Updates in real time.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2.5
- Risk: If the approximation is visibly wrong, it destroys trust.

**Idea 5: Retirement Countdown**
- What it is: A numeric counter on every tile of the current-lowest active tier showing estimated spawns before next retirement.
- Pillar served: Interesting decisions every move
- Implementation gate: v1.5
- Risk: Estimate misfires feel like broken promises.

*Novelty ranking: 4 → 3 → 5 → 1 → 2*

---

### A2 — The Explorer (Baba is You)

**Idea 1: Resonance Chains**
- What it is: Tiles carry a hidden resonance counter that increments each time they survive a chain without being consumed. When a tile with resonance ≥ 3 is used as a chain endpoint, the result gains an extra ×2 multiplier. Board subtly pulses the tile brighter each time.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2
- Risk: Tiles may merge or fall before resonance accumulates, making mechanic invisible.

**Idea 2: Chain Echo**
- What it is: After a chain resolves, the result tile remembers its chain length. If that tile later starts a new chain, the echo length adds to the new chain's s-value. A faint ring animation is the only hint.
- Pillar served: Interesting decisions every move
- Implementation gate: v2.5
- Risk: Compounding multipliers could break score scaling. *[FLAGGED: Rule D tamper — see Constraint Violations]*

**Idea 3: Fault Lines**
- What it is: Invisible column-pair fault lines that shift position every ~15 moves. When a chain crosses a fault line, one extra tile is consumed but not counted in s — silently disappears.
- Pillar served: Depth that reveals slowly
- Implementation gate: v3+
- Risk: Silent tile loss may read as a bug rather than a mechanic.

**Idea 4: Value Memory (Orphan Inheritance)**
- What it is: When a retired orphan blocker is consumed in a chain, the result tile inherits the orphan's original tier value as a hidden bonus added to s.
- Pillar served: Felt mastery curve
- Implementation gate: v2
- Risk: May trivialize the retirement system if exploiting orphans is always correct.

**Idea 5: Adjacency Shadow**
- What it is: Each tile has a hidden directional "shadow" based on how it spawned. Aligned-shadow chain starts double the result. Readable only from a subtle 1-pixel gradient on the tile edge.
- Pillar served: Aesthetic identity + Depth that reveals slowly
- Implementation gate: v3+
- Risk: 1-pixel gradient invisible on low-DPI mobile screens.

*Novelty ranking: 5 → 3 → 1 → 4 → 2*

---

### A3 — The Artist (Tetris Effect)

**Idea 1: Harmonic Audio Synthesis Per Chain**
- What it is: Each tile value maps to a fixed musical pitch on a pentatonic stack (2=low bass, 4=minor third, 8=fifth, 16=octave, etc.). Dragging a chain plays each tile's note in sequence. Same-value extension repeats with shimmer. Doubling extension jumps an octave. Chain completion plays the full phrase as a chord bloom.
- Pillar served: Aesthetic identity
- Implementation gate: v2
- Risk: Cacophony on fast play or large boards.

**Idea 2: Liquid Merge**
- What it is: Tiles are colored liquid in glass containers. Chain draw shows liquid flowing between cells like water through pipes. On completion, all liquid rushes into the final cell, which swells and settles as the result tile.
- Pillar served: Aesthetic identity
- Implementation gate: v2.5
- Risk: Fluid simulation expensive on low-end mobile; animation cannot block fast play.

**Idea 3: Breath Board**
- What it is: Board animates with idle breathing — tiles pulse at phase-offset rates, higher-value tiles pulse slower. Touch snaps everything to stillness. Chain release exhales: tiles scatter as particle dust, result tile lands with ripple propagating outward.
- Pillar served: Aesthetic identity
- Implementation gate: v1.5
- Risk: Ambient animation may distract during planning.

**Idea 4: Color Temperature Gradient**
- What it is: Tile color maps to a thermal gradient: deep ocean blue-teal (2, 4) → amber/gold (16–64) → white-violet (256+). Retired tiles render desaturated grey. Board average color temperature shifts visibly with progression.
- Pillar served: Aesthetic identity
- Implementation gate: v1.5
- Risk: Color accessibility; needs secondary shape/size signal for colorblind players.

**Idea 5: Echo Trails**
- What it is: Every completed chain leaves a luminous trail that fades over 3–5 seconds in the result tile's color. Multiple echoes coexist, layering. Sound design mirrors: soft tonal hum persists and fades with the trail.
- Pillar served: Aesthetic identity
- Implementation gate: v1.5
- Risk: Dense fast play may obscure tile values with overlapping trails.

*Novelty ranking: 5 → 3 → 1 → 2 → 4*

---

### A4 — The Achiever (Hades)

**Idea 1: The Chain Atlas**
- What it is: A persistent visual map recording every distinct chain shape the player has ever completed — length, path geometry, result value. Fills like a field guide; rare long chains marked as discoveries.
- Pillar served: Felt mastery curve
- Implementation gate: v2
- Risk: Cluttered UI causes players to ignore it.

**Idea 2: Epitaphs**
- What it is: Run-end generates a one-line epitaph from actual run data ("Held the board together for 43 moves. Never touched a 256."). Saved to a personal graveyard.
- Pillar served: Failure that teaches
- Implementation gate: v1.5
- Risk: Template staleness breaks the illusion on repeated phrasing.

**Idea 3: Retirement Ledger**
- What it is: Persistent document recording every retired tier, the run it happened on, and the highest chain produced using that tier before it left. ("Run 17: the 2s are gone. Best chain they ever produced: 128.")
- Pillar served: Depth that reveals slowly
- Implementation gate: v1.5
- Risk: Empty ledger if player never reaches retirement milestones.

**Idea 4: Personal Bests by Board State**
- What it is: Tracks personal bests segmented by active tile pool at the time — e.g., "Best score when 2s were still live: 4,820." Displayed at run-end as context for the score.
- Pillar served: Honest reward structure
- Implementation gate: v2
- Risk: Too many segments fragment the sense of accomplishment.

**Idea 5: The Inheritance System**
- What it is: At run end, player chooses one "inheritance" to carry forward — a single tile (highest value achieved, capped) placed at a fixed board position at the next run's start. Visually distinct.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2.5
- Risk: High-value inheritance could trivialize early-game tension.

*Novelty ranking: 5 → 2 → 1 → 3 → 4*

---

### A5 — Mechanics Domain (Spelunky)

**Idea 1: Orphan Cascade**
- What it is: When a retired orphan tile is sandwiched between two chain tiles during resolve, it "cracks" — becoming a wild tile that counts as any value for one chain. After use, it shatters and disappears permanently.
- Pillar served: Aesthetic identity (orphans have a lifecycle that encodes board history)
- Implementation gate: v1.5
- Risk: Wild-tile power too strong, trivializing chain-extension decisions.

**Idea 2: Resonance Chains (Fork)**
- What it is: A fork interaction where a chain passes through a tile that is simultaneously the end of another player-drawn chain. If both results are equal, they auto-merge without a chain required.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2.5
- Risk: Fork detection complex; player may not understand why it fired. *[FLAGGED: Rule D / one-chain-per-turn — see Constraint Violations]*

**Idea 3: Gravity Scar**
- What it is: Chains of length 6+ mark their result column as a scar for 3 turns. Scarred columns spawn tiles one tier higher than the current pool.
- Pillar served: Interesting decisions every move
- Implementation gate: v2
- Risk: Scar + retirement may inflate board tier faster than intended.

**Idea 4: Echo Tiles**
- What it is: Roughly every 40 spawns, one tile spawns as an Echo — same value, ghost outline. Cannot start a chain but can be a chain extension. When consumed mid-chain (not end-chain), doubles the result.
- Pillar served: Felt mastery curve
- Implementation gate: v1.5
- Risk: Cannot-start rule may create apparent-but-illegal chain starts on sparse boards.

**Idea 5: Fault Lines**
- What it is: One randomly placed horizontal fault line per game session (fixed, shown at start). Tiles falling through hang for one turn mid-column. A hanging tile is adjacent to the tile above AND below simultaneously, for that turn only.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2
- Risk: One-turn timing window may be too tight to act on deliberately on mobile.

*Novelty ranking: 5 → 3 → 1 → 4 → 2*

---

### A6 — Content & Rewards Domain (Slay the Spire)

**Idea 1: Resonance Tiles**
- What it is: Special tile that mirrors the chain's current end value when included. Acts as a same-value extension. If chain ends ON the resonance tile, it locks as that value and splits into two tiles of that value on the nearest empty adjacent cells.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2
- Risk: Mirroring rule confuses new players about the tile's value during building.

**Idea 2: Fault Lines**
- What it is: Column boundaries periodically marked as fault lines. When a chain result lands, tiles on both sides of a fault line at the same row gain a hairline crack. A cracked tile used as same-value extension in any future chain causes a cascade clear of all cracked tiles on board.
- Pillar served: Interesting decisions every move
- Implementation gate: v2.5
- Risk: Too-frequent fault lines fill board with cracks, becoming noise.

**Idea 3: Echo Chains**
- What it is: After any chain with ≥2 doubling steps, an "echo window" opens for one move. The first chain starting on the result tile gets its final result doubled. Echo window expires after any other chain or timer.
- Pillar served: Felt mastery curve
- Implementation gate: v1.5
- Risk: Timer edges toward FOMO; must be generous.

**Idea 4: Anchor Tiles**
- What it is: Rare tiles marked with anchor icon that cannot be moved by gravity. Can only be removed by ending a chain directly on them. Terminal anchor multiplies chain result by 1.5× rounded up to nearest power of 2. Spawn only in bottom two rows. One anchor max at a time.
- Pillar served: Interesting decisions every move
- Implementation gate: v2
- Risk: Multiple simultaneous anchors create unwinnable states (must cap at one).

**Idea 5: Tier Bridges**
- What it is: Chain touching exactly three distinct value tiers produces a "bridge" result tile, which counts as matching with both the tier below and above for chain-start purposes, for one use only.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2.5
- Risk: Three-tier chain trigger is non-obvious; players may never discover it. *[FLAGGED: Rule D tamper — see Constraint Violations]*

*Novelty ranking: 4 → 1 → 5 → 3 → 2*

---

### A7 — Economy & Meta-Progression Domain (Mini Metro)

**Idea 1: Route Memory**
- What it is: Board remembers last 3 completed chains as faint colored transit-line overlays. Non-mechanical, purely visual. Board accumulates a palimpsest of decision history over a session.
- Pillar served: Aesthetic identity
- Implementation gate: v2
- Risk: Visual clutter obscures tile readability.

**Idea 2: Line Gauge (Session Economy)**
- What it is: Chains contribute length-points to a Line Gauge progress bar styled as an extending transit route at the screen edge. Full gauge banks one Extension Token. Tokens let player add one free tile to any legal chain mid-draw. Max 3 tokens carry into next session.
- Pillar served: Depth that reveals slowly
- Implementation gate: v2.5
- Risk: Free-tile bridge trivializes adjacency constraint at high token income. *[FLAGGED: Adjacency constraint violation — see Constraint Violations]*

**Idea 3: Network Map (Cross-Session Meta)**
- What it is: Persistent "system map" screen between sessions — each session adds a station dot connected by a line whose color and thickness encodes that session's score. Milestone unlocks add named stations. After 50 sessions: a dense personal map.
- Pillar served: Felt mastery curve
- Implementation gate: v3+
- Risk: Sparse map for infrequent players may feel punishing.

**Idea 4: Tile Retirement Ledger**
- What it is: Persistent sidebar styled as grayed-out transit lines taken out of service, one per retired tier, with the session number it retired in.
- Pillar served: Honest reward structure
- Implementation gate: v1.5
- Risk: Empty ledger for players who never reach retirement.

**Idea 5: Demand Pulse (Board Pressure Economy)**
- What it is: Every 8 moves, one random column pulses as a high-demand corridor. Chains terminating in that column this turn score 2× result. Pulse travels to adjacent column each trigger, circling the board.
- Pillar served: Interesting decisions every move
- Implementation gate: v2
- Risk: Multiplier interacting with Rule D may feel arbitrary.

*Novelty ranking: 5 → 3 → 1 → 2 → 4*

---

### A8 — Feel & Juice Domain (Threes!)

**Idea 1: Tier Voice Registers**
- What it is: Each tier has a distinct instrument family: 2=thumb-piano plucks, 4=marimba, 8=vibraphone, 16=steel-string guitar harmonics, 32=cello pizzicato, 64=bowed bass, 128+=synth-organ with sub-bass. Tapping a tile plays its note. Each extension plays the next tile's note, building a melodic phrase. Chain completion plays all notes as a chord.
- Pillar served: Aesthetic identity
- Implementation gate: v2
- Risk: Melodic randomness could feel cacophonous on dissonant tile layouts.

**Idea 2: Chain Path Ink Trail**
- What it is: Chain path renders as an animated ink stroke — thick, slightly irregular, with ink-bleed at tile nodes. Stroke color shifts along a warm hue ramp by result value (low=amber, mid=rose, high=violet). On commit, ink contracts inward to result tile as a reverse brushstroke; result tile absorbs it with an ink-bloom pulse. Abandoned chains: ink dries out, cracks, fades.
- Pillar served: Aesthetic identity
- Implementation gate: v1.5
- Risk: Canvas rendering of dynamic ink strokes may drop frames on mobile during drag.

**Idea 3: Tile Weight Physics on Drop**
- What it is: Drop animations weighted by tile value: 2s/4s fall with quick light bounce; 32s/64s fall with heavy thud and slight screen-shake; 128+ briefly compresses all tiles in column by 4px before spring-back. Result tile always lands with the heaviest animation. Sound: wooden tap (small) → felt thud (mid) → stone impact (large).
- Pillar served: Felt mastery curve
- Implementation gate: v1.5
- Risk: Column compression could create visual confusion about board state.

**Idea 4: Tile Face Aging**
- What it is: Tiles have minimal two-dot eyes. Fresh = wide-open. 3+ turns without use = heavy-lidded. Orphaned retired tiles = closed eyes, slightly faded fill. Selected tile's eyes open wide and pupils track drag direction. Result tile blinks open on creation.
- Pillar served: Aesthetic identity
- Implementation gate: v2
- Risk: Face rendering adds per-tile complexity; aging state may be missed as decorative noise.

**Idea 5: Chain Commit Freeze Frame**
- What it is: At chain commit (finger release), 120ms freeze: all tiles freeze, path flashes white, result value appears large over resolution zone. Then tiles vanish in sequence from first to last (30ms/tile, particle burst in tier color). Result tile slides in from above the board edge. Total ~400ms.
- Pillar served: Failure that teaches
- Implementation gate: v1
- Risk: 400ms per chain resolution compounds into sluggishness under fast play.

*Novelty ranking: 4 → 2 → 1 → 5 → 3*
