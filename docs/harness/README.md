# Harness — Index

The test harness is a game-balance simulation lab. The bot is a player proxy;
metrics are reproducible distributions; outputs are JSON manifests so any past
run can be replayed and any agent can introspect what was measured.

**Mission, KPIs, and roadmap:** the active planning doc lives at
`/Users/eluckey/.claude/plans/do-a-deep-dive-recursive-clover.md`.

**Stats reference:** [STATS.md](./STATS.md) — how to read CIs, why bootstrap, the
pairing rule of thumb.

## Quick start

```bash
npm run harness                                      # help
npm run describe -- all                              # schema for agents
npm run baseline                                     # capture baselines/perf-<id>.json
npm run bench    -- --mode classic --n 30 --seed 1
npm run sweep    -- --rows 7,8 --cols 5,6 --pool 4,6 --seeds 30
npm run study    -- wilds-launch --seed 42 --n 30
npm run replay   -- dist/bench-1234.json             # bit-exact reproduction
npm run compare  -- a.json b.json                    # paired/independent auto-detected
npm run power    -- --manifest a.json --metric peak --mde 5
```

## Subcommands

| Command | Purpose | Output |
|---|---|---|
| `harness bench` | Per-mode benchmark across spawn algos | `dist/bench-<ts>.json` + table |
| `harness sweep` | Cartesian sweep over board×pool | `dist/sweep-results.<ts>.json` + table |
| `harness baseline` | Reference run for drift detection | `baselines/perf-<id>.json` |
| `harness study <name>` | Pre-canned study (`scripts/studies/`) | `dist/study-<name>.<ts>.json` |
| `harness replay <manifest>` | Re-run with the same args/seeds | new manifest, bit-exact game state |
| `harness compare <a> <b>` | Per-cell delta CIs between manifests | table; auto paired / independent |
| `harness power [flags]` | Required-N for an MDE given variance | per-cell table or one-shot |
| `harness describe <topic>` | Self-describing schema for agents | JSON: metrics \| bots \| modes \| algos \| all |

## Common flags

- `--seed <uint32>` — master seed; deterministic seed list (replayable).
- `--seeds <csv>` — explicit seed list (overrides `--seed`).
- `--n <int>` — number of seeds. Defaults: bench 20, sweep 30, baseline 30.
- `--max-moves <int>` — per-game move cap (default 300).
- `--max-games <int>` — total-games guardrail (default 5000); refuses runs above this without `--allow-long`.
- `--allow-long` — bypass guardrails for legitimate large runs.
- `--out <path>` — override output JSON path.

## Manifest envelope

Every output JSON includes:

```json
{
  "schemaVersion": 1,
  "schema": "harness-benchmark" | "harness-sweep-config" | "harness-perf-baseline" | "harness-study-<name>",
  "script": "scripts/...",
  "command": "npx tsx scripts/harness.ts ...",
  "gitSha": "...",
  "nodeVersion": "v24.11.1",
  "platform": "darwin-arm64",
  "cpu": "Apple M4",
  "cpuCount": 10,
  "totalMemoryMB": 24576,
  "timestamp": "2026-04-25T19:33:15.801Z",
  "args": { ... },
  "seedList": [ ... ]
}
```

`harness replay` reconstructs argv from these fields and re-invokes the
relevant subcommand.

## Adding a new study

1. Drop a file at `scripts/studies/<name>.ts` exporting `main(argv: string[]): void`.
2. Use `parseFlags` from `_lib.ts` for arguments and `envelope` for the manifest.
3. Set `schema: "harness-study-<name>"` in the manifest so replay can find it.
4. `harness study <name>` discovers it automatically (registry built from `scripts/studies/*.ts`).

## Architecture, in one paragraph

`scripts/harness.ts` is the dispatcher. Each subcommand lives in its own file
exporting `main(argv)`. `scripts/_lib.ts` holds all shared infrastructure
(arg parsing, formatters, stats, manifests, guardrails). `src/game/bot.ts`
runs games and produces `BotResult` + `BenchmarkSummary` (with full
distributions and CIs). `scripts/schema.ts` is the agent-facing description
of metrics/bots/modes/algos and is the source of truth for what the harness
exposes.
