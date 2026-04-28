# Game Design Concepts & Frameworks

**Status:** Reference document — stable
**Audience:** Designer (Evan), future projects, learners
**Use case:** Vocabulary, frameworks, design principles for casual puzzle game design
**Updates:** Rare — only when new concepts are added or existing ones refined
**Companion documents:**
- *Merge Game Specification* — current state of the merge game project
- *Merge Game Design Journal* — process log and audit notes for that project

---

## How to use this document

This is a textbook-style reference. It captures the vocabulary, frameworks, and design principles relevant to designing casual puzzle games — specifically those with progression mechanics, chain mechanics, and merge mechanics. It's organized so you can:

- Read top to bottom for an overview of the field
- Skip to a specific concept (numbered sections) when you need to recall a definition
- Use it as a starting point for future game design projects

Most of the content here was assembled in service of a specific project (the merge game), but the concepts themselves are general-purpose.

---

## 1. The three fields

We started by distinguishing three fields that share vocabulary but are genuinely distinct:

- **Game design** — the craft of designing playable systems (mechanics, dynamics, aesthetics, playtesting). Mostly a humanities/craft discipline.
- **Game theory** — the mathematics of strategic decision-making among rational agents (Nash equilibria, zero-sum, cooperative games). Mostly economics/math.
- **Gamification** — applying game-like elements (points, progression, feedback loops) to non-game contexts. Mostly product/behavioral design, often controversial.

We focused on game design because the goal is to build something. Game theory and gamification have informed parts of the conversation (mechanism design surfaced as a candidate interest area early on; gamification's "dark patterns" framed the engagement-vs-affection distinction later).

## 2. The MDA framework

The most-cited academic framework in game design (Hunicke, LeBlanc, Zubek, 2004):

- **Mechanics** — the formal rules and components of the game (what the system literally does)
- **Dynamics** — the behavior that emerges when those rules meet a player (what actually happens during play)
- **Aesthetics** — the emotional responses the player has (fun, tension, pride, surprise)

Key insight: **the designer builds from M up** (rules → emergent behavior → emotion), but **the player experiences A down** (feels emotion → notices behavior → eventually understands rules). Misalignment between these perspectives is the root of most design failure.

## 3. The six-layer working frame

A practical decomposition of how casual puzzle games stack:

| Layer | What it is | Vocabulary lives here |
|---|---|---|
| 1. Core mechanic | The fundamental rule of play | Verbs, state, rules, the core loop |
| 2. Content design | Special tiles, blockers, wilds, modifiers | Friction, boons, level layouts |
| 3. Objectives | What defines winning a level/round | Score targets, move limits, survival |
| 4. Meta-progression & economy | What persists between rounds | Currency, stars, boosters, energy, daily challenges |
| 5. Game feel / juice | Polish layer | Particles, screen-shake, hit confirms |
| 6. Cross-cutting concepts | Principles governing all above | Risk/reward, flow, mastery curves |

This frame structures our design process: we work bottom-up (Layer 1 first), and each layer has its own design vocabulary.

## 4. Engagement vs Affection vs Mastery

Three distinct retention concepts often conflated, especially in mobile gaming:

- **Engagement** — people keep playing right now. Easy to manufacture with variable rewards, energy timers, FOMO, streaks. Effective short-term, corrosive long-term. Most "F2P retention design" is this.
- **Affection** — people recommend the game, return after long absences, feel *good* about time spent. Requires actual depth, respect for player time, honest reward structure.
- **Mastery satisfaction** — players notice themselves *getting better*. The deepest hook of all and the most underrated.

The games people genuinely return to for years (Tetris, Threes!, Drop7, Wordle, NYT Crossword, Slay the Spire) hit affection and mastery without leaning on engagement tricks. **Engagement follows from love; love does not follow from engagement.**

This distinction set our optimization target: design for affection and mastery, not engagement.

## 5. The six pillars of beloved games

The shared properties of games people genuinely love and return to:

1. **Depth that reveals slowly.** Simple rules, vast strategic space that keeps unfolding over hours and hundreds of hours of play.
2. **Interesting decisions every move.** Sid Meier's bar — every action involves a real tradeoff with no obviously-correct answer.
3. **Failure that teaches.** When you lose, you understand why and want to try again. The death state illuminates the strategy.
4. **Felt mastery curve.** Players notice themselves getting better. Yesterday's hard puzzle is today's easy one. *The most underrated retention mechanic.*
5. **Aesthetic identity.** A distinctive look, sound, and feel that's recognizable in two seconds. (Threes! has more identity than 2048; same mechanic, totally different soul.)
6. **Honest reward structure.** What you put in, you get out. Skill-correlated rewards, not slot-machine rewards. Luck doesn't dominate decisions.

These pillars become the audit criteria for kernel design (Step 1.5).

## 6. Game archetypes

Distinct flavors of "loved and returned to" with different design priorities:

| Archetype | Example | Key design priorities |
|---|---|---|
| **Cult favorite** | Threes! | Depth, signature aesthetic, infinite replayability. Skip heavy meta-progression. |
| **Mass casual** | Candy Crush | Hundreds of designed levels, currency, energy, social hooks. Heavy meta-progression. |
| **Daily ritual** | Wordle, NYT Crossword | One fresh puzzle/day. Share-friendly results. No infinite play. |
| **Hardcore mastery** | Slay the Spire | Extreme depth. Runs feel meaningfully different. Long-tail engagement. |
| **Cozy / chill** | Stardew, Suika | Warmth, forgiveness, vibe. Low pressure. |

These have radically different design requirements — choosing an archetype shapes meta-progression, content load, monetization, art direction, even pacing.

## 7. Kernel and knobs (modal design)

A pattern used by games that serve multiple archetypes simultaneously: **separate what's invariant (kernel) from what varies between modes (knobs).**

Examples:
- Tetris: marathon, sprint, ultra, battle modes — all share the same kernel (place falling shape; full lines clear) with different knobs (speed curve, win condition, opponent presence).
- Slay the Spire: standard runs + ascension + daily climb + custom seeds — all share the deck-building roguelike kernel with different difficulty/seeding knobs.
- Hades: base game + Pact of Punishment modifiers — shared kernel with stackable challenge knobs.

The principle: **the kernel must be the minimum shared experience across all modes.** If a rule isn't true in *every* mode, it's a knob, not a kernel.

The **hero mode** is the one mode you design first, polish first, and use to validate the kernel. Get this wrong and you waste months building modes for a mechanic that wasn't fun.

## 8. Classes of tradeoffs in puzzle games

A "tradeoff" = a choice where picking option A means giving up a real benefit of option B. The Sid Meier insight is that good puzzle games **layer multiple tradeoffs into a single move.**

Eight named classes that recur across the genre:

| Tradeoff | Pits this against this |
|---|---|
| **Now vs Later** | Immediate payoff vs better future state |
| **Big vs Small** | High-cost/high-reward vs low-cost/low-reward |
| **Use vs Save** | Spend a powerful resource or hold it |
| **Path vs Placement** | Which tiles you touch vs where the result ends up |
| **Climb vs Clear** | Advance tier vs free space *(specific to merge games)* |
| **Simple vs Risky** | Guaranteed small vs probable larger |
| **Local vs Global** | Solve immediate corner vs reshape whole board |
| **Greedy vs Strategic** | Obvious good move vs hold for emerging pattern |

A *real* tradeoff has genuine value on both sides. A *fake* tradeoff has one obviously-correct side, producing no real choice — that's a dead decision and a dead mechanic.

## 8a. Spawn distribution: three concepts that aren't the same

Late in the design discussion we surfaced an important distinction. Three concepts that get conflated but are actually independent levers:

1. **Range** — the set of tile values the system supports. Currently 2-256 (eight tiers). Could be extended.
2. **Active tiers on the board** — how many distinct values can exist on the board at once. Constrained by range plus what chains have created.
3. **Spawn algorithm** — which subset of values actually spawns each turn, and with what weights. Independent of range.

Each is a separate design decision:
- Range determines the *ceiling* of what's possible
- Active tiers determines the *variety* of what's present
- Spawn algorithm determines the *distribution* of what appears

For our v1: range = 2-256, active tiers = 8 (same as range, no restriction), spawn algorithm = power-law decay with weights = 1/value. These are tunable independently.

The retirement mechanic interacts with all three: it shifts the spawn algorithm (lowest tier stops spawning) which, via sliding window, shifts the range (new top tier joins). Active tiers stays constant.

## 9. Layer 1 deep-dive: core mechanics

A mechanic is a formal rule of the game with three components:

- **Verbs** — what the player can do (move, merge, place, swap, draw, build...)
- **State** — what exists and changes (tiles on a board, cards in hand, units on a map...)
- **Rules** — how verbs operate on state (identical tiles merge into double value...)

### Three named lenses on mechanics

1. **Sid Meier's definition:** "A game is a series of interesting decisions." Every mechanic should produce one. If a player's choice has no real consequence or has an obvious dominant answer, the mechanic is broken.
2. **Doug Church's "intention and perceivable consequence."** A good mechanic lets the player form an intention and *immediately perceive* the result. Invisible delayed effects break this.
3. **Daniel Cook's "skill atoms."** Every mechanic is a tiny cycle: action → simulation → feedback → modeling → mastery. Well-designed mechanics produce a learning curve on their own.

### Five principles of good mechanic design

1. **Elegance** — small rule, vast emergent depth (Go, Tetris)
2. **Coherence** — mechanics that share a theme reinforce each other
3. **Interesting-decision test** — every choice has meaningful tradeoffs
4. **Emergent over scripted** — great mechanics produce experiences the designer didn't anticipate
5. **Avoid dominant strategies / degenerate mechanics** — no single tactic always wins; no unintended loophole breaks the design

### Categories of mechanics (broad taxonomy)

- Movement, resource management, pattern-matching, combat/interaction, construction/placement, information mechanics, probability/generation, time mechanics, economic mechanics

Counting the *number of distinct verbs* in a game is a quick proxy for its complexity.

### Two case studies referenced

- **Tetris** (Pajitnov, 1984). One verb, one state, one rule. Difficulty from speed alone. Most-ported game in history. *A single great mechanic can carry a game forever.*
- **Threes!** (2014). Slide one tile + one merge rule + one preview tile. The preview is the key design choice — partial future information makes decisions interesting in a way 2048's pure randomness doesn't. *Small rule additions can profoundly change strategic depth.*

## 10. Layer 2 deep-dive: content design

The "stuff that fills the board" — special tiles and modifiers. Splits into friction and boons.

### Friction elements

- **Blockers / obstacles** — static tiles taking up space, can't be chained, must be cleared somehow
- **Hazards** — actively threatening (timers that fill cells with garbage)
- **Locked tiles** — frozen, need N adjacent merges to unlock
- **Decay tiles / timer tiles** — change state over moves (the "must be chained within X moves or it becomes a blocker" pattern)
- **Spreading hazards** — propagate to neighbors each turn (Candy Crush ice)
- **Garbage / junk** — periodically spawned non-chainable clutter

### Boon elements

- **Wilds / jokers** — match any value
- **Multipliers** — boost chain output
- **Bombs / clears** — single-use tiles wiping a row, column, or value-X tiles
- **Specials / power-ups** — earned tiles with abilities (swap, undo, peek)
- **Modifier zones** — board regions with different rules

### Special-tile creation rules

The genius of Candy Crush: **specific match patterns produce specific specials.** Match 4 in a line → striped candy. Match 5 → color bomb. Match L-shape → wrapped candy. The pattern "do something fancy → get something fancy" is a *reward gradient* that teaches players to want harder matches.

For our merge game: chain length 5+ could spawn a wild. Chains using 3+ doubling extensions could spawn multipliers. Chains ending on a specific tier could spawn bombs. *(Deferred to Layer 2 design phase.)*

## 11. Layer 3 deep-dive: objectives

The "win condition" vocabulary. Most casual games combine 2-3 per level.

Standard catalog:

- **Score target** — reach N points
- **Tile target** — produce a tile of value X
- **Move limit** — within Y moves
- **Time limit** — within Y seconds
- **Survival** — last as long as possible
- **Combo objective** — perform a chain of length N
- **Clear objective** — clear all tiles of type X
- **Collect objective** — produce N tiles of value X
- **Bring-down** — items at top must "fall" through merges to bottom

Levels are typically *assembled* from these — most levels combine 2-3 stacked objectives.

## 12. Layer 4 deep-dive: meta-progression and economy

The reasons to come back. Critical to longevity, easy to do badly:

- **Levels / chapters** — designed sequence of levels
- **Stars / medals** — 1/2/3 star ratings per level
- **XP and player level** — overall progress meter
- **Currency** — earned in rounds, spent on:
  - **Boosters** — pre-game advantages
  - **In-game power-ups** — used during play
  - **Lives / energy** — limit play sessions
- **Daily challenges** — fresh content each 24h
- **Battle pass / season pass** — time-limited progression track
- **Achievements** — long-term goals
- **Leaderboards** — social comparison
- **Unlockables** — themes, modes, characters

Vocabulary: **core loop** (one round of play) vs **meta loop** (between rounds). Both must feel rewarding in their own right.

## 13. Layer 5 deep-dive: game feel / juice

The polish layer that solo developers consistently underweight. Named concepts:

- **Juice** (Jonasson/Purho) — visual/audio feedback that makes actions feel kinetic
- **Hit confirm** — clear feedback that an action registered
- **Reward burst** — celebration of success scaled to magnitude
- **Anticipation** — telegraphing what's about to happen
- **Wind-down / settle** — visual rest after action

Reference: "Juice It Or Lose It" GDC talk by Martin Jonasson and Petri Purho.

## 14. Layer 6 deep-dive: cross-cutting concepts

Principles governing multiple layers at once:

- **Risk/reward decision** — every meaningful choice should have one
- **Push-your-luck** — keep going for more reward at increasing risk
- **Agency vs randomness** — balance between skill and luck
- **Mastery curve** — how skill ceilings reveal themselves over hours
- **Flow** (Csíkszentmihályi) — optimal challenge zone
- **Difficulty curve** — how challenge scales over levels
- **Variable reward schedules** — Skinner-derived; payoffs at unpredictable intervals
- **Roguelike elements** — runs end, permadeath, but meta-currency persists
- **Onboarding / tutorialization** — teaching rules without text walls

## 15. Genre survey: number-merge games

The canonical lineage and what each does differently:

| Game | Year | Movement | Merge rule | Number progression | Goal |
|---|---|---|---|---|---|
| **Triple Town** | 2010 | Discrete placement | 3 same → 1 next | Themed upgrade chain | Reach high tier |
| **Drop7** | 2009 | Drop into columns | Pattern (value N clears in row/col of N) | 1-7 discs | Survive scoring |
| **Threes!** | 2014 | Slide one tile | 1+2=3 then doubling | Custom: 1,2,3,6,12,24... | Reach high tile |
| **2048** | 2014 | Slide all the way | 2 same → 1 next | Powers of 2 | Reach 2048 |
| **Suika** | 2021 | Drop with physics | 2 same → 1 next | Themed upgrade chain | Reach watermelon |

Design dimensions used to compare them:

- **Movement model** — slide all / slide one / drop with physics / discrete placement
- **Merge rule** — 2 same / 3 same / pattern-based
- **Number progression** — powers of 2 / Fibonacci / arbitrary upgrade chain / themed
- **Goal structure** — reach target / survive / score / objective-based
- **Signature twist** — every successful entry has one thing predecessors don't

Our game's hybrid combines elements: chain-based (path-traversal like Boggle), powers of 2 (like 2048), 8-way adjacency, *two extension rules* (same-value OR doubled-adjacent), gravity drops + spawn (like Drop7), 6×7 portrait grid.

## 16. Recommended references

Captured for future deep-dives:

- **Hunicke, LeBlanc, Zubek**, "MDA: A Formal Approach to Game Design and Game Research" (2004) — the canonical framework
- **Jesse Schell**, *The Art of Game Design: A Book of Lenses* — 100 lenses, the practical bible
- **Dixit & Nalebuff**, *The Art of Strategy* — readable game theory
- **Daniel Cook**, blog "Lostgarden" — especially "Game Skill Atoms" and "Loops and Arcs"
- **Frank Lantz**, writings on Drop7 — the closest cousin to our game
- **Jonasson & Purho**, "Juice It Or Lose It" GDC talk
- **Roger Caillois**, *Man, Play and Games* — taxonomy of play (agon, alea, mimicry, ilinx)
- **Bernard Suits**, *The Grasshopper* — what is a game philosophically
- **Anna Anthropy**, *Rise of the Videogame Zinesters* — manifesto for personal games

---


---

*End of Concepts document.*
