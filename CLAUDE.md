# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

2248 chain-merge game — a single-player puzzle where chains of equal-rank tiles collapse into the next rank. React 19 + Vite 8 + TypeScript (strict). Targets Node 22.

The repo bundles two things: the playable game (`src/`) and a balance-simulation **harness** (`scripts/`) that runs deterministic bot games and emits replayable JSON manifests.

## Layout

- `src/game/` — pure engine. Core files: `engine.ts`, `bot.ts`, `spawn.ts`, `rules.ts`, `scenarios.ts`. Determinism is funnelled through `rng.ts` so that any (seed, args) pair produces a bit-exact game.
- `src/components/`, `src/views/`, `src/hooks/` — UI layer. Entry point is `src/App.tsx`.
- `scripts/` — harness dispatcher (`harness.ts`), shared lib (`_lib.ts`), and named studies under `scripts/studies/`. All harness output JSON is written to `dist/`.
- `baselines/` — committed reference perf manifests used for drift detection.
- `docs/harness/` — harness usage (`README.md`) and stats methodology (`STATS.md`).

## Common commands

- `npm run dev` — Vite dev server. `.claude/launch.json` pins port **5180** with `--strictPort`; do not change.
- `npm run lint` — `eslint .`
- `npm run build` — `tsc -b && vite build`

Harness aliases (each is `npx tsx scripts/harness.ts <subcommand>`):

- `npm run harness` — print help and list studies.
- `npm run bench` — per-mode benchmark across spawn algos.
- `npm run sweep` — Cartesian sweep over board × pool.
- `npm run baseline` — capture `baselines/perf-<id>.json`.
- `npm run study -- <name>` — run a registered study from `scripts/studies/`.
- `npm run replay -- <manifest.json>` — bit-exact reproduction of a past run.
- `npm run compare -- <a.json> <b.json>` — paired/independent delta CIs (auto-detected).
- `npm run power` — required N for an MDE given variance.
- `npm run describe -- <topic>` — agent-facing JSON schema.

## Agent-facing schema

`npm run describe -- all` dumps a single JSON object describing **metrics**, **bots**, **modes**, and **algos**. Use this before adding new harness flags or interpreting manifest fields — it is the source of truth for what the harness exposes.

## Conventions

- **No comments unless the *why* is non-obvious.** Identifiers carry intent; reserve comments for invariants, surprises, and workarounds.
- **Manifests are bit-exactly replayable.** Every harness output carries a `gitSha` + `seedList` envelope; `harness replay <manifest>` reconstructs argv from those fields. Don't add non-deterministic state to manifests.
- **Never edit `baselines/*` without an explicit balance-change rationale.** Baselines are the drift-detection ground truth; rewriting them silently invalidates all open comparisons.

## Don'ts

- No features beyond the task at hand.
- No backwards-compatibility shims — this is a private game, just change the code.
- Never run sweeps with `--allow-long` without explicit user confirmation; the default `--max-games 5000` guardrail exists for a reason.

## Pointer

TODO: deep domain context (bot strategy, mode design, study catalogue) lives in `docs/AGENTS.md` — that file lands in #2.
