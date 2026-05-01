# Journal Entry Draft — 2026-05-01

**For:** `docs/Merge_Game_Design_Journal.md` (Evan-only writes; this file is a draft for review/paste-in)

**Author of this draft:** Engineering agent
**Triggering conversation:** Death-mechanism study findings review + manual play-test by Evan

---

## Suggested entry — to be inserted near the most recent journal entries

### 2026-05-01 — Lifecycle framing clarified; retirement is pressure, not milestone

**Context:** First-pass death-mechanism study (`docs/engineering/studies/01-death-mechanism.md`)
ran 7 bot archetypes through the game and concluded the design "punishes effort"
— smarter bots died faster than dumber bots. The study proposed retirement
fixes (less-eager trigger, capped retirements, opt-in mechanics).

I reviewed the findings while playing the game manually. After triggering
retirement at 512 by hitting that tile, I cleared all the retired 2s without
stranding any of them. Recovery was trivial. The study's claim that "no
recovery path exists for normal players" was empirically false — at least
for a single retirement event.

**The corrected framing — the game is a lifecycle, not a single arc:**

```
Free Play → Friction (retirement fires) → Cleanup → Conquest 🎉 → Loop
```

- **Free Play:** No retired tiles on board. Any style works.
- **Friction event:** Retirement fires when a tile reaches the next tier.
- **Cleanup:** Retired tiles are now liabilities. Player must target chains
  that include them, before gravity strands them.
- **Conquest:** All retired tiles of tier V cleared. **This is the milestone**
  — a "level beaten." Worth visual celebration.
- **Failure mode:** Retired tiles got stranded → permanent dead weight on
  the board. Tier "lost," not conquered.
- **Loop:** Spawn pool advances; back to Free Play. Repeat.

**The bots failed because none of them adapted between phases.** They each
played a single fixed strategy — appropriate for Free Play OR Cleanup, but
never switching. Real players adapt: free-play normally, then shift to
cleanup-targeting when retired tiles appear. The bots' deaths reflect *bad
bot design*, not bad game design.

The single worst bot (`cleanupPrioritizer`) targeted retired cells but
preferred big chains within that constraint. Its big chains kept triggering
the next retirement before it could finish cleaning the previous one. It
died fastest of all 7 archetypes (~58 turns vs. casual's ~300+). Cleanup
done wrong is worse than not doing it.

**Rejected:** the earlier "retirement is unavoidable runaway" framing.
Retirement is the *intended* friction event. The runaway only happens for
players who never enter cleanup mode — which describes my bots, but not
real players.

**Settled (soft commitment):**
- The lifecycle Free Play → Friction → Cleanup → Conquest → Loop is the
  canonical mental model for the game loop.
- "Conquest" terminology — fully clearing a retired tier is the milestone,
  worth UX treatment (visual + audio celebration).
- Bot-based studies of this game must use **phase-aware adaptive bots**;
  single-scorer bots are invalid as proxies for human play.

**Deferred:**
- UX for the lifecycle: visible phase indicator (Free Play / Cleanup /
  Conquest), celebration moment when a tier is conquered, persistent badge
  for conquered tiers, distinguishing "tier conquered" from "tier lost"
  in score/progression.
- Whether Phase 1 (Free Play) needs its own friction. Currently below the
  first retirement threshold any play style survives — possibly fine for
  early game, possibly a missed opportunity for skill differentiation.
- An adaptive bot has not yet been built. Once it exists, re-running the
  death-mechanism study will tell us whether the design works *as designed*
  or whether the cleanup window is too tight even for a good strategy.

**Things to verify in playtest:**
- Can a normal player conquer the first tier (clear all retired 2s) without
  prior coaching? Or does the lifecycle need explicit teaching?
- Is the moment of "you triggered retirement" visible enough that a player
  switches to cleanup mode? Without UX cues, players may not notice the
  phase shift.
- After conquering the first tier, does the game cleanly reset to Free
  Play at the new tier, or do residual board effects (high-tier tiles,
  fragmented mid-tiers) make the next loop harder than the first?

**Cross-references:**
- `docs/engineering/studies/01-death-mechanism.md` — full study, rewritten
  with lifecycle framing.
- Auto-memory: `project_lifecycle_framing.md`, `project_retirement_is_pressure.md`,
  `project_badge_vs_nomination.md`, `project_magnitude_scales_cleanup.md`,
  `feedback_adaptive_bots.md`.

---

### Same date — Two follow-on insights from board-puzzle review

While reviewing a specific board state (turn 110, captured during manual
play), two additional design insights emerged:

**1. Magnitude scales cleanup — the intrinsic difficulty scaler.**

The chain mechanic produces results that grow exponentially with chain
length (Rule D bonus). A long chain can produce a result that crosses
*multiple* retirement thresholds in one play, retiring multiple tiers
simultaneously and creating a proportionally larger cleanup workload.

This means the game has a built-in difficulty scaler that requires no
separate tuning: **the harder you push, the harder cleanup gets.** Skill
expression is not "find the longest chain." It is:

> **"Find the longest chain you can also clean up after."**

Concretely: the turn-110 board has a length-10 chain that produces 4096,
crossing both the 1024→2048 and 2048→4096 retirement thresholds. Triggers
a *cascading double retirement* — the 8 and 16 tiers both retire from one
play. The "obvious good move" creates the largest possible cleanup burden.

This makes "obvious good moves" into traps without breaking the game. The
trap is *real consequence*, not artificial difficulty.

**2. Badge vs Nomination — the achievement model.**

A tier conquest has two states:

- **Nominated:** player triggered the friction event but did not fully
  clean up. Some retired tiles became stranded → permanent dead weight.
- **Badge earned:** player triggered the friction event AND successfully
  cleared every retired tile of every retired tier, leaving no dead tiles.

The badge proves both halves of mastery: setup ability (constructing the
play over many turns) AND cleanup ability (managing the consequences).
A player cannot bluff into a badge — playing safe never earns one (the
big play is required) and playing recklessly fails the cleanup half.

This is the cleanest possible skill expression. It also gives the game a
diagnostic fail-state: "you got nominated but didn't conquer" tells the
player exactly what they didn't finish, instead of just "you lost."

**Settled (soft commitment):**
- Badge vs Nomination is the canonical achievement model for tier conquest.
- Magnitude-scales-cleanup is the intrinsic difficulty scaler — keep it,
  don't paper over it with tuning.

**Deferred to UX:**
- Visual distinction between *nominated* and *badge earned* states for
  each tier. Persistent badge display.
- "Lost tier" state (retired tiles permanently stranded) as a third
  end-state, distinct from nominated and earned.
- Pre-commit feedback on the consequence cost of a play (how many retired
  tiles will exist after this chain?) so players can make informed
  ambition decisions.

---

### Same date — Result value (not chain length) is what scales cleanup

Initial framing said "long chains create scaled retirement challenge."
Evan corrected: *result value*, not chain length, is the lever. A short
chain at high tile values does the same damage as a long chain at low
tile values.

Concrete proof (turn 139 board state, captured during manual play): a
4-tile same-value chain of four 1024s in an L-shape produces 4096
(via Rule D bonus from same-extensions), triggering cascading retirement
of both 8 and 16 tiers. Same result, same consequences, in 4 moves
instead of 10.

**Settled (soft commitment):** Result value is the lever, not chain
length. UX feedback should surface result-value-relative-to-thresholds,
not chain length.

---

### Same date — Strategic tension: control vs randomness

Evan articulated the core tension while discussing how he deliberately
constructed the turn-110 and turn-139 trap board states:

> Players control chains. The game controls spawns. Strategic play is
> the dance between the two.

A player who delays a chain to build a particular pattern is *betting
against the spawning system* — buying time to construct a configuration,
while accepting that random spawns may invalidate it. The board filling
up provides a natural ticking clock on patience.

This duality is the **engine of skill expression**. Don't paper over it
by reducing randomness or giving players too much spawn control.

**Settled (soft commitment):** Reward mechanics should *recognize*
setup-heavy play (which engages the duality fully), rather than reduce
randomness (which would defeat the engine).

**Open design question — under exploration:** how do we *incentivize*
setup-heavy strategic play so the moments of delight Evan found by
imagination become real for all players?

Brainstorm (2026-05-01, lightweight options favored for first iteration):

1. **Pattern badges** — recognize special chain shapes (Pool Traversal,
   Cluster Master, Cascade Maker) and award badges with visual flourish.
2. **Multi-conquest badge tier** — extend the existing Badge model:
   *Double Conquest* (clean up 2 cascaded tiers), *Triple+* etc. Directly
   rewards setup-heavy play because cascades require it.
3. **Hidden achievements** — don't list these; surprise reveal when
   triggered. Encourages exploration: "what else is hidden?"

Heavier options under consideration but not preferred for first pass:

4. **Earned tile bank** — badges earn "wild placements." Increases setup
   precision but reduces randomness; tension with the duality principle.
5. **Restraint multiplier** — score bonus scaling with turns since last
   chain. Makes the gamble explicit but may feel too gamified.

**Recommended first iteration:** #1 + #2 + sprinkle of #3. Additive
only, no rule changes. Reveals the hidden depth Evan found by accident.

---

## Notes from the engineering agent

- I wrote a first version of the findings doc that argued the design was
  broken. It was wrong. Evan caught it by playing the game. The rewrite
  is in place.
- Memories saved cross-session so future agents won't repeat the same
  framing mistakes.
- The `cleanupPrioritizer` archetype is preserved in the codebase as a
  known-bad probe — useful comparison point for future adaptive-bot work.
- The proposed `adaptiveStrategy` (next experiment) is not yet built. Want
  to validate the lifecycle framing first before adding more bot infra.
