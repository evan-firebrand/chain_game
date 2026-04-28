# 2248

A single-player chain-merge puzzle: drag through paths of equal-rank tiles to collapse them into the next rank, build chains, and survive as long as the spawn pool keeps escalating. Built with React 19, Vite 8, and TypeScript (strict).

## Quick start

```bash
npm install
npm run dev
```

The dev server runs on port **5180** (pinned via `.claude/launch.json`).

## Project layout

- `src/game/` — pure, deterministic engine (rules, spawn algos, bot, scenarios, RNG).
- `src/components/`, `src/views/`, `src/hooks/`, `src/App.tsx` — UI layer.
- `scripts/` — balance-simulation harness. The dispatcher is `scripts/harness.ts`; named studies live under `scripts/studies/`.
- `baselines/` — committed reference perf manifests for drift detection.
- `docs/harness/` — harness usage and stats methodology.

## Eval harness

The harness runs deterministic bot games and emits replayable JSON manifests. See [`docs/harness/README.md`](docs/harness/README.md) for the full CLI surface and [`docs/harness/STATS.md`](docs/harness/STATS.md) for how to read confidence intervals and paired-bootstrap deltas.

## Working with Claude Code

If you're contributing as (or with) an agent, start at [`CLAUDE.md`](CLAUDE.md) — it covers the layout, conventions, and don'ts that aren't obvious from the source alone.
