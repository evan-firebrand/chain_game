# Game Design Concepts & Frameworks

**Status:** Reference document — stable
**Audience:** Designer (Evan), future projects, learners
**Use case:** Vocabulary, frameworks, design principles for casual puzzle game design AND for design tooling
**Updates:** Rare — only when new concepts are added or existing ones refined
**Companion documents:**
- *Merge Game Specification* — current state of the merge game project
- *Merge Game Design Journal* — process log and audit notes for the game design
- *Merge Game Tooling Specification* — current state of the design tooling project
- *Merge Game Tooling Journal* — process log and audit notes for the tooling design

---

## How to use this document

This is a textbook-style reference. It's organized in two parts:

- **Part A — Game Design Concepts (Sections 1-16).** Vocabulary, frameworks, and design principles for casual puzzle games — specifically those with progression mechanics, chain mechanics, and merge mechanics.
- **Part B — Internal Tooling Concepts (Sections 17-25).** Design principles for the internal tools that support game design work — tuning consoles, simulation harnesses, design intent solvers, and related infrastructure.

You can:
- Read either part top to bottom for an overview of the field
- Skip to a specific concept (numbered sections) when you need to recall a definition
- Use this as a starting point for future game design projects

Most of the content here was assembled in service of a specific project (the merge game and its tooling), but the concepts themselves are general-purpose.

---

# PART A — GAME DESIGN CONCEPTS

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

# PART B — INTERNAL TOOLING CONCEPTS

The sections above (1-16) cover game design proper. The sections below (17-25) cover the design of *internal tooling* used to build games. Most of these concepts are general-purpose for any internal tooling; a few are specific to game design tools.

The sections share vocabulary with the game design sections — kernel/knobs, audit principles, archetype thinking — but apply them to tools as the artifact being designed.

## 17. The role of internal tools in game design

Tools are the **substrate that makes design iteration cheap.** Game design is a search problem — you don't know what fun is until you find it, and you find it by trying many variants. The cost of one iteration sets the upper bound on how thoroughly you can search the design space. Tools lower iteration cost.

Three named principles from the field:

**1. Tools are designed, not built.** Treating tools as throwaway scaffolding produces brittle, untrusted tools that nobody uses. Designed tools — with intentional UX, clear workflows, and audited assumptions — get used. The discipline is to apply the same design rigor to the tool that you'd apply to the product. *Carmack repeatedly said the game is downstream of tool quality.*

**2. The cost of tool quality compounds.** Every design decision after a tool is built benefits from that tool. A tool that's 10% better than a worse tool, used 100 times, isn't 10% more valuable — it's compounding. The corollary: undertooling early is *expensive*, but it's invisible because the cost shows up as slow iteration rather than a line item.

**3. Tools encode hypotheses.** A parameter slider implies "this matters and is worth varying." A telemetry chart implies "this metric is meaningful." Tools aren't neutral — they shape what the team thinks about. Bad tools narrow attention to the wrong variables.

## 18. Tool archetypes

Just as games have archetypes, tools have them — and the right archetype for a tool depends on its primary user and use case:

| Archetype | Primary user | Optimization target | Failure mode |
|---|---|---|---|
| **Designer's microscope** | Solo designer / small team | Speed of "what if?" answers | Becomes a procrastination toy |
| **Team's dashboard** | Cross-functional team | Shared awareness, agreement | Becomes meeting-driven, slow |
| **QA's stress rig** | Quality engineers | Bug reproduction, edge cases | Diverges from production |
| **Researcher's instrument** | Designer-as-scientist | Reproducibility, statistics | Optimizes for wrong metric |
| **Public playground** | External audience | Engagement, education | Wrong-audience design choices |

The tool's archetype shapes everything downstream — UI complexity, exposed parameters, workflow assumptions, security model. Other archetypes are deferred but should not be foreclosed by architecture.

## 19. Single source of truth (the load-bearing tooling principle)

The single biggest mistake in game tooling: **the simulator and the game disagree.** A sim harness or analytics tool that has its own copy of "what is a chain" or "how does retirement work" will, over time, drift from the actual game. This is **simulation drift**, and it's catastrophic when discovered — every analytical conclusion the team reached using the simulator becomes suspect.

The fix is architectural:

> **Extract pure game logic into a module that has no UI dependencies. The playable game imports it. The simulator imports it. Both are downstream consumers of the same logic.**

This pattern shows up in many fields:
- Web development: separate "domain logic" from "view layer"
- Database systems: separate "schema" from "presentation"
- Machine learning: separate "model" from "training/serving infrastructure"
- Compilers: separate "frontend parsing" from "backend codegen"

In game terms, the model is:

```
[ pure game logic module ]   ← the single source of truth
        ↑               ↑
        │               │
   [ playable game ]  [ sim harness ]
        ↑                   ↑
        │                   │
   [ tuning console ]  [ batch runner ]
```

The pure-logic module knows *nothing* about rendering, sound, sliders, or charts. It exposes a deterministic API: given a state and an action, produce the next state.

This isn't optional for tooling work. Without it, every tool you build accumulates technical debt that eventually invalidates it.

## 20. Instrumentation principles

Once the pure-logic module exists, **instrumentation** is what makes it observable. Every meaningful event in the game emits a signal. Three principles:

**1. Instrument the model, not the view.** Events fire from the game-logic module, not from UI code. This way, both playable games and simulated games emit the same events.

**2. Events should be self-describing.** Each event includes context (current state, parameters in effect, timestamp/turn number) so that a single event log can be meaningfully replayed or analyzed. *"Chain completed"* is not enough; *"chain completed: length 5, doublings 2, same-values 1, result tile 32, position (3,4), turn 47, k=2, grid 6×7"* is.

**3. Default to recording everything; filter at analysis time.** Storage is cheap; recreating sessions is expensive. Record liberally during prototype phase. Tighten in production.

## 21. Parameter exposition (what to expose, what to fix)

The temptation: expose every parameter. The reality: **most parameters shouldn't be exposed**, because exposing them implies "this is worth varying," which is often wrong.

The named tradeoff: **exposition vs decisiveness.**

- *Over-exposition* — a sea of sliders. Encourages tuning by feel rather than by playtest. Defers commitment indefinitely.
- *Under-exposition* — too few sliders. Forces code changes for design questions, which are slow and intimidating.

The discipline:

**Three exposition tiers:**

| Tier | Description | Example |
|---|---|---|
| **Tier 1 — Live tunables** | Exposed in the UI, changeable during play | Spawn weights, key formula constants |
| **Tier 2 — Config tunables** | In a config file/object, changeable but requires restart | Grid dimensions, structural parameters |
| **Tier 3 — Code constants** | Hard-coded; changing requires code editing | Fundamental design commitments |

The principle: **tier corresponds to certainty.** Tier 3 things are settled by design and shouldn't be testable. Tier 2 things are settled but might want comparison. Tier 1 things are actively under exploration.

If everything is Tier 1, nothing is decided. If nothing is Tier 1, the tool isn't doing its job.

## 22. Simulation harness patterns

A sim harness is a non-visual game runner driven by automated strategies. Three named pieces:

**1. Strategies (the "player").** A strategy is a function that, given a game state, returns an action. Three baseline strategies are usually enough to triangulate:

- **Random valid play.** Picks any legal action at random. Establishes the worst-case difficulty floor.
- **Greedy (highest-immediate).** Always picks the action with the best immediate result. Establishes the obvious-strategy ceiling and reveals dominant strategies.
- **Heuristic (designed approximation of skilled play).** Encodes design intent: prefer X in early game, prefer Y when board is full, etc. Best proxy for skilled human behavior.

A bot is *not* a substitute for a human, but multiple bots covering the strategy space approximate the *envelope* of human outcomes.

**2. Runners (the "experiment").** A runner takes a strategy and a configuration, runs N games, collects results. Two flavors:

- **Single-config runner** — given one parameter set, run 1000 games, output statistics.
- **Sweep runner** — vary one parameter across a range, run 1000 games at each setting, output a chart.

**3. Analyzers (the "interpreter").** A runner produces raw event logs. An analyzer extracts statistics — distributions, percentiles, correlations.

The key principle: **strategies, runners, and analyzers are independent layers.** You can swap any one without rewriting the others.

## 23. Failure modes specific to tooling

Worth naming because they're predictable:

**1. The procrastination trap.** Building tools to avoid playing the game and finding out it isn't fun. Combat: every tool feature has to answer a specific real question; if you can't name the question, don't build it.

**2. Simulation drift.** Sim and game disagree. Combat: single source of truth (Section 19).

**3. Sliderification.** Every decision becomes a slider. Combat: tier discipline (Section 21).

**4. Statistics theater.** Producing impressive charts that don't change any decisions. Combat: every metric should pre-commit to a decision rule. "If median game length under config X is below 15 minutes, we change spawn rate" — *not* "let's see what happens."

**5. Bot overfitting.** Tuning the game to make bots happy. The bot is a lens, not the player. Combat: keep human playtest in the loop alongside simulation.

**6. The maintenance tax.** Tools that aren't maintained drift, break, and stop being trusted. Combat: build less; treat tool code with the same review/test discipline as game code.

## 24. The "build less, build well" discipline

Three heuristics worth adopting:

**1. Smallest tool that answers the question.** Resist the urge to build "the right architecture" up front. Start with the cheapest thing that produces an answer; add structure as the tool's value justifies it.

**2. One question per build cycle.** Each tool feature exists to answer a specific question. When the question is answered, the feature is done. Avoid the open-ended "this might be useful someday" build.

**3. Docs > UX.** A tool that's well-documented but mediocre to use is more valuable than a beautiful tool nobody understands. Comments, README, decision records — the tool's *understandability* compounds over time.

## 25. Forward and inverse modes in design tooling

Design tools fall into two modes that look related but solve different problems and require different architectures:

**Forward mode: parameters → outcomes.** "Given this configuration, what kind of game results?" The designer sets inputs; the tool reveals outputs. This is the natural mode of tuning consoles and simulation harnesses. Cognitive load: experiment-driven exploration.

**Inverse mode: outcomes → parameters.** "Given this design intent, what configurations achieve it?" The designer states targets; the tool reveals which inputs produce them. Cognitive load: requirements-driven solving.

The split has names across many fields — **forward problem vs inverse problem** in optimization, **tuning vs design intent solving** in game design, **analysis vs synthesis** in mechanism design, **prediction vs inference** in ML.

### Why inverse mode is fundamentally harder

Four reasons inverse mode is mathematically harder than forward mode:

**1. The parameter space is large.** With many tunable parameters, the full configuration grid quickly grows beyond exhaustive enumeration.

**2. The mapping is non-injective.** Multiple parameter sets can produce similar metrics — meaning "what configuration produces this game" doesn't have a unique answer. Inverse mode returns a *set* of answers, not one.

**3. The mapping is non-monotonic.** Increasing one parameter doesn't reliably move a given metric in one direction. You can't just "tune one slider until the metric matches."

**4. Design intent is multi-dimensional.** Stating intent isn't one number — it's a *vector* of metrics (length, max value reached, event frequency, distribution shape, failure rate). Optimizing for one may trade against another.

These are not blockers. They're solved problems in optimization theory. They just require more sophisticated tooling than forward mode.

### Three approaches to inverse mode

**Approach 1: Parameter sweep + structured filtering.** Brute-force forward simulation across a grid of configurations, store all results in a database, then filter by target outcomes. The "inverse" is structured search through a forward-generated dataset.

- *Pros:* Conceptually simple. Reuses forward simulator. Results are real (no model assumptions). Easy to extend with new metrics.
- *Cons:* Sweep is expensive — only feasible when individual simulations are fast. Coverage is limited to discretized configurations.
- *When right:* Small-to-medium parameter spaces, fast simulators, when you want ground truth answers.

**Approach 2: Surrogate models / Bayesian optimization.** Build a statistical model that learns the parameter→metric mapping from a smaller sample of forward runs, then optimize over the model rather than the simulator directly.

- *Pros:* Far more efficient than brute force. Standard ML/research technique.
- *Cons:* Requires more sophistication. Surrogate model can be wrong. Adds implementation and validation complexity.
- *When right:* Large parameter spaces, slow simulators, when you have time to invest in modeling infrastructure.

**Approach 3: Direct gradient-free optimization.** Use algorithms like CMA-ES, evolutionary strategies, or simulated annealing to optimize the simulator directly as a black-box function.

- *Pros:* Powerful. Handles complex objective functions including multi-objective tradeoffs.
- *Cons:* Most complex to set up and validate. Easy to misconfigure (local minima, premature convergence). Often overkill for prototyping scope.
- *When right:* Production-scale tuning at large studios. Late-stage live-game balancing.

### The unifying insight: same data, two queries

Forward and inverse aren't really separate tools — they're the **same dataset queried in different directions.** A simulation database with rows like:

```
{ inputs: { k: 2, grid: 6×7, ... }, outputs: { length: 15.3, max_tile: 1024, ... } }
```

Forward query: "for these inputs, what were the outputs?"
Inverse query: "filter rows where outputs match my targets, return inputs."

This unification has architectural implications: **build the simulation harness's data model with inverse querying in mind from day one.** Doing so means inverse mode comes nearly free once forward batch mode exists. Treating them as separate tools doubles the work.

### Practical guidance

Three rules of thumb:

1. **Build forward modes first.** Inverse mode requires forward mode under the hood. Until you've validated the simulator (forward, single-config), inverse mode is building on sand.

2. **Use Approach 1 unless proven inadequate.** Brute-force sweep + structured filtering covers 80% of design intent questions and is genuinely cheap to extend. Reach for surrogates or optimization only when sweep becomes too slow or the parameter space too large.

3. **Multi-objective is normal; design for it.** Real design intent involves multiple metrics simultaneously. The intent solver should support multi-criteria filtering and Pareto-front views, not just single-metric optimization.

---

*End of Concepts document.*
