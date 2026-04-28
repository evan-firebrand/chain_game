# Brainstorm Swarm Framework

## Purpose

A structured multi-agent ideation system for generating diverse, high-quality game design ideas for Chain Game. Agents work in parallel to prevent convergence, each seeded with a specific player persona or design domain and a reference game that shapes their mental model.

---

## Architecture

### Phase 1 — Parallel Generation (8 agents, run simultaneously)

| Agent | Type | Archetype / Domain | Reference Game | Mental Model Injected |
|---|---|---|---|---|
| A1 | Persona | The Optimizer | Into the Breach | Complete information + decision clarity; skilled play = seeing 2-3 moves ahead |
| A2 | Persona | The Explorer | Baba is You | Mechanical revelation; players feel clever discovering non-obvious implications |
| A3 | Persona | The Artist | Tetris Effect | Synesthetic identity; audio-visual response transforms a mechanical game into an emotional one |
| A4 | Persona | The Achiever | Hades | Meta-progression psychology; failure creates narrative; runs feel distinct through emergent combinations |
| A5 | Domain | Mechanics | Spelunky | Emergent board storytelling; fair RNG; board state encodes history |
| A6 | Domain | Content & Rewards | Slay the Spire | Synergy as strategy; combinations > individual power; build theory from a fixed verb set |
| A7 | Domain | Economy & Meta-Progression | Mini Metro | Network/path visual language; legible and beautiful simultaneously; constraint-driven progression |
| A8 | Domain | Feel & Juice | Threes! | Tile personality; color as progression language; merge game with a soul |

### Phase 2 — Synthesis (1 agent, runs after Phase 1 completes)

Reads all 40 ideas, produces:
- Top 10 by (novelty × pillar alignment)
- 3 combination moves — pairs of ideas that reinforce each other
- Constraint violations flagged
- Cluster map — ideas that converged across multiple agents (high signal)

### Optional Phase 3 — Stress Test

Pick top 5 from synthesis. Spin up 5 Devil's Advocate agents, one per idea, tasked with actively breaking each idea against the six pillars. Output: survivability rating + weakest pillar for each idea.

---

## Quality Guardrails (enforced in every agent prompt)

Every agent must, for each idea:

1. **Cite a design pillar** — name which of the 6 pillars it serves and specifically how
2. **Tag an implementation gate** — v1 / v1.5 / v2 / v2.5 / v3+ (Levels) / v4+ (Ascension) / v5+ (Drift)
3. **Name one risk** — what could go wrong, which pillar it threatens
4. **Produce exactly 5 ideas** — no more, no fewer
5. **Self-rank 1–5 by novelty** — forces agents to surface their most non-obvious idea

---

## Hard Constraints (injected into every prompt)

These are non-negotiable. Ideas that violate them are discarded:

- **Rule D, k=2 is sacred** — do not propose changes to the result formula: `result = last_tile × 2 × 2^⌊s/2⌋`
- **Core chain mechanic is fixed** — adjacency, same-value start, same-value / doubled-adjacent extensions, no tile reuse
- **Endless mode must work standalone** — no ideas that require another mode to function
- **Retirement is v1.5, not v1** — ideas involving retirement mechanics are tagged v1.5+
- **No engagement-metric design** — no streak mechanics, energy systems, FOMO timers, or pay-to-continue patterns

---

## Design Pillars Reference

From the game's design audit — all six matter equally, no tradeoffs:

1. **Depth that reveals slowly** — non-obvious mechanics discovered through play, not tutorial
2. **Interesting decisions every move** — 3–5 plausible options per turn, real tradeoffs
3. **Failure that teaches** — loss condition is visible, concrete, skill-correlated
4. **Felt mastery curve** — multiple skill axes, visible personal records, progress is felt
5. **Aesthetic identity** — looks/sounds/feels like itself, not a 2048 clone *(biggest current gap)*
6. **Honest reward structure** — results correlate with chain quality, RNG bounded by skill

---

## Anti-Convergence Mechanisms

1. **Parallel execution** — all 8 agents run simultaneously, never see each other's output
2. **Reference game assignment** — different mental models produce different solution spaces
3. **Excluded concepts list** — each prompt lists 2-3 obvious ideas already on the table that agents must not repeat:
   - *"Add a combo multiplier to the score"*
   - *"Show a ghost/preview of the result before committing the chain"*
   - *"Add a bomb tile that clears a 3×3 area"*
4. **Persona vs domain split** — 4 agents think as players, 4 think as designers; these produce structurally different idea shapes

---

## Design Space Map

Current state per area — used to orient agents:

| Area | Status | Notes |
|---|---|---|
| Core chain mechanic | Settled | Rule D, k=2; 8-way adjacency; no tile reuse |
| Grid | Settled (tunable) | 6×7 default; 5×6 to 7×8 range |
| Spawn distribution | Settled (tunable) | 1/value power-law; 8-tier pool |
| Tile retirement | Designed, not built | Hard retirement; sliding 8-tier window; stranding |
| Aesthetic identity | **Open — biggest gap** | Zero implementation; highest priority for v2.5 |
| Score formula | Placeholder | Max tile = score; needs replacement |
| Special tiles / Layer 2 | Deferred | Waiting for core validation |
| Meta-progression | Deferred | v2+ priority |
| Levels mode | Deferred | v3+ |
| Ascension modifiers | Deferred | v4+ |
| Drift parameters | Deferred | v5+ |

---

## Running the Swarm

### Via Claude Code (manual)

Open 8 terminal tabs. In each, run:
```
claude --print "$(cat docs/swarm_prompts.md | extract_prompt A1)"
```

Or use the Agent SDK to spawn all 8 in a single script (see `tools/run_swarm.py` when built).

### Output format

Each agent writes a structured response. Collect all 8 into a single file, then pass to the synthesis agent prompt (A9 in `swarm_prompts.md`).

### Re-running with variation

To get a second pass of diverse ideas:
- Rotate reference games (swap 2-3 of the 8)
- Change the excluded concepts list to include the top ideas from the first run
- Swap 1-2 persona archetypes (e.g., replace The Achiever with The Completionist or The Speedrunner)
