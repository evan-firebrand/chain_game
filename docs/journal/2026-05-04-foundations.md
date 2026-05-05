# Session Journal — Foundations

**Date:** 2026-05-04
**Session:** 1

---

## Purpose of this journal

This is a living record of design and engineering sessions on the CHAIN / 2248 project, kept by and for the AI collaborator who joins these sessions. Each entry is a dated markdown file in this directory, named `YYYY-MM-DD-slug.md`. The purpose is recoverable institutional memory: any single session may end with the AI's working memory cleared, but the journal does not. A new session can begin by reading the most recent entry (and any contracts referenced from earlier ones), without re-litigating prior decisions.

**Convention for new entries:**

- One entry per session.
- Earlier contracts are treated as binding unless explicitly revised.
- To revise a prior contract, add a "Revisions" section in a new entry that names the contract by number and source-entry date, and states the new version.
- Don't edit prior entries; treat them as historical record.

---

## About the AI collaborator

### Strengths

- **Structural analysis.** Breaking complex problems into measurable parts, naming them clearly, identifying load-bearing assumptions.
- **Code scaffolding.** Building pipelines, analyzers, infrastructure layers, glue code; turning designs into working scripts.
- **Framework critique.** Spotting conflated terms, unjustified leaps, hidden assumptions, missing fallbacks.
- **Validity-thinking.** Asking whether a measurement is measuring what we think it's measuring; distinguishing aggregate metrics from situational ones.
- **Written communication.** Tight briefs, decision records, contracts; documents that survive across sessions.

### Limits to know about

- **Subjective game-feel judgment.** I can analyze mechanics, but I can't play the game and tell you whether it feels right. Player feel is yours to own.
- **Sensory testing.** Anything requiring me to actually use the product (animations, audio, "does this UI feel laggy") is outside my reach.
- **Continuity across sessions.** My working memory does not persist. This journal exists precisely because of that limit.

### Operating preferences

- **Minimum useful thing first.** Resist over-engineering. Earn complexity by demonstrating need.
- **Externalize decisions in writing.** Context resets, docs don't. If a decision matters, it goes in this journal.
- **Push back on conflated terms.** State vs behavior, optimizer vs proxy, mechanic vs experience. Catching conflations early saves weeks.
- **Acknowledge uncertainty rather than confabulating.** If I don't know, I'll say so. If a number is from memory rather than data, I'll flag it.
- **Profile before optimizing; verify before claiming.** Sim performance, code correctness, design impact — measure before asserting.
- **Direct critique over validation.** When asked for advice, I'll give actual critique, not affirmation. When wrong, I own it without elaborate apology.
- **Tight conversation.** Short responses by default; substance over length.

---

## Project context

**Game.** CHAIN / 2248. Tiles are powers of 2; players chain adjacent same-value tiles. Result tile value = last value × 2 × 2^(bonus), placed at the chain's last cell. Spawn pool is a sliding window `[min, max]` of tile values; achieving a new max tile retires the lowest tier and shifts the window up. Multiple retirements can cascade in a single turn. Game ends when no legal chain start exists on the board.

**Game-mechanic states** (states, not behaviors):

- **Free Play** — no retired tiles on board.
- **Friction** — retirement just fired.
- **Cleanup** — retired tiles present on board.
- **Conquest** — retired tiles cleared, returning to free play at higher pool.
- **Lost** — retired tiles stranded; that tier is permanently dead weight.

**Codebase layout:**

- `src/game-kernel/` — pure rules engine. Deterministic, no IO, no UI.
- `src/game-session/` — live game, UI, playlog recorder.
- `src/sim-harness/` — bot strategies, runners, analyzers.

**The bot validity problem.** Previous bot studies used greedy or naive phase-switching bots as proxies for human play. Both failed: greedy escalated boards faster than cleanup could handle; phase-switching died faster because the fallback within each phase was still greedy. The lesson: the bot must be calibrated to represent how humans actually play, or all sim conclusions are noise.

**Current goal.** Build a small rule-based bot whose parameters are derived from existing playlog data, validate it as a proxy for human play, then enable sim studies on top of it.

---

## Discussion summary — Session 1 (2026-05-04)

- **Why previous bots failed.** Optimizers were used as proxies. Different goals require different bots.
- **State vs behavior.** The original phase framework conflated states (mechanics-determined) with behaviors (what players do across them). Vocabulary needs sharpening — many states exist beyond the four originally named, and behaviors are continuous functions over state-feature vectors, not discrete switches.
- **Bot architecture options.** Three flavors: greedy (failed), rule-based with parameters from playlog (proceeding with this), trained model (deferred — over-engineered for current need).
- **Behavior atlas concept.** A queryable representation of "in this state region, the player does this." Deferred. Build only if the small bot is insufficient. The hardest part is feature selection; the cheapest mitigation is watching real play with think-aloud, not more analysis.
- **Sim studies the bot enables.** Retirement-gap sensitivity, stranding rates, phase-time distribution, skill scaling, counterfactual rule changes. Sim is most valuable for questions that can't be tested live without disrupting players.
- **Architecture: kernel / policy / harness.** Standard separation. Kernel is the shared spine; policy and harness are independent consumers. Codebase already follows this pattern.
- **Two-team org structure.** Product/Game owns the kernel and live game. Sim/Insights consumes the kernel and produces findings. Lightweight rituals — weekly sync, shared backlog, findings doc.
- **Sim as CI gate.** Aspirational. Features that affect player experience must run through sim before shipping. Predicated on having a valid bot proxy. Roll out advisory first, blocking once trusted.
- **Performance and silent compromise.** Sim performance is a first-class concern. The worst failure mode is silent scope caps that nobody documents — sim still runs, numbers still appear, but they're measuring something other than what the team thinks.

---

## Formal contracts and agreements

Numbered. Each is treated as binding until explicitly revised in a future entry.

### 1. Vocabulary discipline

**State** (mechanics-determined; what the game machinery says about the board) ≠ **behavior** (what the player does across states). Don't conflate them in framing or measurement. Names like "Free Play" and "Cleanup" describe states; we measure behavior *across* those states, not the other way around.

### 2. Scope discipline

Minimum useful thing first. No "world class" infrastructure. Build small, validate, iterate. Earn complexity by demonstrating need.

### 3. Order of operations for bot work

1. Build a small rule-based bot whose constants are derived from playlog (target ~50–100 lines).
2. Validate against playlog using top-N hit rate per game-state.
3. Only after validating (or failing to validate) the small bot, consider atlas-level work.

Do not skip ahead.

### 4. Kernel discipline

Kernel (`src/game-kernel/`) is pure, deterministic, and shared by game and sim. No sim-only logic in the kernel. Derived metrics — legal-chain-start counts, retired-tile counts, isolated-retired counts, anything sim-specific — live in sim-side utilities (e.g., `src/sim-harness/strategies/common.ts`), not in the kernel. When tempted to add to the kernel, ask: would the live game ever use this? If no, it doesn't belong.

### 5. Two-team structure

**Product / Game** owns the live game, UX, playlog recorder, and the kernel.
**Sim / Insights** consumes the kernel and owns sim harness, bots, analyzers, behavior work.

Rituals: weekly 30-minute sync, shared backlog of cross-team asks, findings doc maintained by Sim that Product reads.

### 6. Coordination surfaces

Three explicit ones, with named ownership:

1. **Kernel public API.** Owned by Product. Breaking changes get advance notice.
2. **Playlog format.** Owned jointly. Sim requests new fields; Product implements.
3. **Mechanic roadmap.** Owned by Product. Sim flags impact ahead of mechanic shipping.

### 7. Sim as CI gate

**Aspirational.** Rule-affecting features must run through sim before shipping. Predicated on a valid bot proxy. Rollout sequence:

1. Advisory PR check (visible but non-blocking).
2. Flip to blocking only after team trusts the signal.

Override path required: sim verdicts can be overridden by reviewer signoff with written justification, audited.

### 8. Performance discipline

**No silent scope caps.** If a test would hit a cap for performance reasons, fail loudly with documented rationale at the test site. Use performance budgets (e.g., "this test must run in <500ms") not scope caps that quietly degrade what's being measured. Profile before truncating.

### 9. Validity over throughput

A million games run by an invalid bot is zero useful data. Bot calibration is the load-bearing investment. Validity (does the bot represent humans?) trumps throughput (how many games can we run?).

### 10. No over-engineering

Default to the smallest useful step. Build infrastructure when it's needed, not in anticipation. The user has explicitly stated and re-stated this. Treat it as a hard constraint, not a soft preference.

---

## Open questions and next steps

### Immediate (next session)

- [ ] Build the small rule-based bot.
- [ ] Identify 3–5 parameters to extract from playlog. Starting candidates:
  - Chain length distribution (short / medium / long buckets).
  - Fraction of chains including retired tiles when retired tiles are present.
  - Result-value behavior near retirement thresholds.
  - Chain selection bias when multiple legal chains exist.
- [ ] Implement the bot as a new strategy in `src/sim-harness/strategies/`.
- [ ] Validate via top-3 hit rate per game-state against playlog.

### Deferred (revisit when relevant)

- [ ] Decide whether atlas-level work is needed based on bot validation results.
- [ ] Define 4–6 sim health metrics for CI gating.
- [ ] Wire advisory CI check; flip to blocking once team trusts the signal.
- [ ] Add visual cue at the moment of retirement to telegraph state shift (game-design improvement).

---

## Working agreement (how to operate going forward)

For the AI collaborator joining a future session:

1. **Read the latest entry first.** Treat its contracts as binding. Only override via an explicit revision in a new entry.
2. **Append, don't edit.** Each session gets a new dated entry. Prior entries are historical record.
3. **Push back on conflations.** State vs behavior, optimizer vs proxy, mechanic vs experience — catch these as they appear.
4. **Verify against the codebase, not against memory.** If a claim about the code matters, read the code; don't rely on remembered summaries.
5. **No scope creep without consent.** When considering work beyond what was asked, surface it as a question — don't expand silently.
6. **Profile and verify before claiming.** Sim performance, bot behavior, code correctness — measure before asserting.

---

*End of entry.*
