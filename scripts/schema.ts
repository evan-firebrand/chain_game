/**
 * Self-describing schema endpoints for AI agents (and humans) inspecting the
 * harness without reading source. `harness describe metrics|bots|modes|algos`
 * dispatches here.
 *
 * Keep this in sync with src/game/types.ts (modes, algos) and src/game/bot.ts
 * (BotResult, BenchmarkSummary, BotPolicy). Agents will use this to choose
 * sensible flags and interpret output, so each entry has both a definition and
 * an interpretation.
 */

import { ALL_MODES, ALL_ALGOS } from "../src/game/types";

export type MetricEntry = {
  name: string;
  type: "perGame" | "aggregate" | "termination";
  definition: string;
  interpretation: string;
  unit?: string;
  notes?: string;
};

export const METRICS: MetricEntry[] = [
  // Per-game (BotResult)
  { name: "moves", type: "perGame", definition: "Chains committed before terminal.", interpretation: "Session length proxy.", unit: "count" },
  { name: "peak", type: "perGame", definition: "Highest tile value reached during the game.", interpretation: "Progression ceiling — how far the player advanced.", unit: "tile value" },
  { name: "score", type: "perGame", definition: "Cumulative score from all chains and bonuses.", interpretation: "Reward signal.", unit: "score points" },
  { name: "avgChainLen", type: "perGame", definition: "Per-game mean chain length: chainLenSum / moves.", interpretation: "Engagement proxy at the per-game level.", unit: "tiles" },
  { name: "chainLenSum", type: "perGame", definition: "Sum of chain lengths across all moves.", interpretation: "Used to compute unbiased aggregate avgChainLen across runs (Σchain / Σmoves).", unit: "tiles" },
  { name: "peakByMove50", type: "perGame", definition: "Peak tile value at move 50 (0 if game ended before then).", interpretation: "Early-game pace indicator." },
  { name: "levelsCleared", type: "perGame", definition: "Number of target tiles hit (512 → 768 → 1024 → ...).", interpretation: "Goal-completion proxy." },
  { name: "highestTargetHit", type: "perGame", definition: "Largest target value successfully hit.", interpretation: "Difficulty-ceiling proxy." },
  { name: "modeMetric", type: "perGame", definition: "Mode-specific primary outcome. classic/boost/wilds: levelsCleared. movesLimited: movesRemaining at game-over. risingFloor: final floor.", interpretation: "Each mode's most-meaningful single number." },
  { name: "terminationReason", type: "termination", definition: "How the run loop ended.", interpretation: "Distinguishes real game-over from move-cap, no-chain, invalid-commit. Replaces the old conflated 'gameOver%'.", notes: "Values: gameOver | moveCapReached | noChainFound | invalidCommit." },
  { name: "runtimeMs", type: "perGame", definition: "Wall-clock ms for the full run loop.", interpretation: "Used for throughput KPIs and Phase 6 perf gating.", unit: "ms" },
  { name: "botDecisionMs", type: "perGame", definition: "Wall-clock ms inside bot decision functions only.", interpretation: "Subtract from runtimeMs to estimate engine-step cost.", unit: "ms" },
  // Aggregate (BenchmarkSummary)
  { name: "avgChainLen (aggregate)", type: "aggregate", definition: "Σ(chainLenSum across runs) / Σ(moves across runs).", interpretation: "Unbiased pooled chain length — different from avg of per-run avgChainLen when run lengths vary." },
  { name: "totalRuntimeMs", type: "aggregate", definition: "Sum of per-run runtimeMs.", interpretation: "Total wall-clock spent on this cell.", unit: "ms" },
  { name: "gamesPerSec", type: "aggregate", definition: "runs.length / (totalRuntimeMs / 1000).", interpretation: "Throughput KPI for this cell.", unit: "games/sec" },
  { name: "terminationCounts", type: "aggregate", definition: "Map of terminationReason → count of runs ending that way.", interpretation: "Breakdown that supersedes the old 'gameOver%' (which conflated four conditions)." },
  // Phase 2: distributions + CIs
  { name: "dists.<metric>", type: "aggregate", definition: "Per-metric DistributionStat: {n, mean, median, stddev, p10, p25, p75, p90, iqr, ciLow, ciHigh, ciHalfWidth}.", interpretation: "Mean is the headline; ciHalfWidth is the 95% bootstrap CI half-width to render 'value ± hw'. P10/P90 captures spread for skewed metrics like peak/score." },
  { name: "avgChainLenStat", type: "aggregate", definition: "{stat, low, high, ciHalfWidth} — bootstrap CI on the unbiased pooled Σchain/Σmoves.", interpretation: "Resamples whole runs to preserve the per-run pairing of chainLenSum and moves." },
  { name: "terminationRates.<reason>", type: "aggregate", definition: "ProportionStat: {rate, low, high} — Wilson 95% CI on each termination reason rate.", interpretation: "Better than the normal-approximation interval for rates near 0 or 1." },
  { name: "seedList", type: "aggregate", definition: "Seeds used by this cell, in order.", interpretation: "Two summaries with identical seedLists can be compared with paired-bootstrap CIs (much tighter than independent CIs); seedsMatch() in scripts/_lib.ts handles the check." },
];

export type BotEntry = {
  name: string;
  policy: "greedy" | "lookahead1" | "random" | "expectimax2" | "heuristic" | "aggressive" | "longChain";
  description: string;
  skillTier: "floor" | "low" | "mid" | "high" | "ceiling";
  notes: string;
};

export const BOTS: BotEntry[] = [
  {
    name: "random",
    policy: "random",
    description: "Picks any valid chain uniformly at random. Uses a bot-specific RNG seeded from the game seed so choices are deterministic and reproducible.",
    skillTier: "floor",
    notes: "Skill floor. Use for sanity checks ('does skill matter?') and variance reference. Greedy should beat random by a wide margin on all metrics.",
  },
  {
    name: "greedy",
    policy: "greedy",
    description: "Picks the immediate chain with the highest mode-aware score (mergeValue × multiplier × pathLength + Wilds urgency bonus).",
    skillTier: "mid",
    notes: "Myopic. Default policy. DFS-enumerates all chains up to depth 5.",
  },
  {
    name: "heuristic",
    policy: "heuristic",
    description: "Top-K=32 immediate candidates by greedy score; re-ranks by chainScore + 50×freeSpace + 100×longestChainRemaining(post). Designed as a mid-tier upgrade over greedy.",
    skillTier: "mid",
    notes: "Empirically NOT better than greedy: paired CI on Δ(levels) includes 0 at N=30 (weighted +9 ± 17, antiPair +9 ± 27). Finding: hand-tuned board heuristics don't transfer from 2048-swipe to 2248-chain games — the chain choice captures most strategic value already. Kept in the library as a sanity check / negative result; use greedy or lookahead1 in practice.",
  },
  {
    name: "aggressive",
    policy: "aggressive",
    description: "Style persona. Picks the chain with highest mergeValue² × √pathLength — strongly prefers big merges over long chains.",
    skillTier: "mid",
    notes: "Not a skill-tier addition — a play-pattern probe. Expect higher peak/score per move but fewer total levels (short chains miss multi-target setups).",
  },
  {
    name: "longChain",
    policy: "longChain",
    description: "Style persona. Picks the chain with highest mergeValue × pathLength² — strongly prefers length over merge value.",
    skillTier: "mid",
    notes: "Not a skill-tier addition — a play-pattern probe. Expect higher avgChainLen and possibly more levels (longer chains hit more targets) but lower peak.",
  },
  {
    name: "lookahead1",
    policy: "lookahead1",
    description: "Top-K=8 immediate candidates by greedy score; simulates one realised commit each and adds 0.9 × greedy score on the resulting board.",
    skillTier: "high",
    notes: "Significantly better than greedy on levelsCleared (paired CI excludes 0 for all algos). Uses the correct realised spawn for each candidate, so it is not fooled by adversarial spawns.",
  },
  {
    name: "expectimax2",
    policy: "expectimax2",
    description: "Top-K=8 immediate candidates; for each, averages the best greedy follow-up score over S=8 sampled spawn outcomes (Monte Carlo chance-node). Picks argmax of immediate + 0.9 × expected follow-up.",
    skillTier: "high",
    notes: "Matches lookahead1 on weighted/antiPair spawn (within CI at N=20). Weaker on adversarial: chance-node sampling uses RNG perturbation (≈ uniform random tiles), which is systematically optimistic for a spawn algo that deliberately picks hostile tiles. ~40x slower than greedy; use --n 10-15 for sweeps.",
  },
];

export type ModeEntry = {
  name: string;
  description: string;
  primaryMetric: string;
  notes?: string;
};

export const MODES: ModeEntry[] = [
  { name: "classic", description: "Standard rules. Chains merge, score accumulates, peak tile climbs, targets unlock at 512/768/1024/...", primaryMetric: "levelsCleared" },
  { name: "risingFloor", description: "Spawn floor rises one power-of-2 every level cleared. Easier early, brutal late.", primaryMetric: "floor (final)" },
  { name: "boost", description: "Some spawned tiles are boosted (multiplier-like flag) and expire after N moves.", primaryMetric: "levelsCleared" },
  { name: "movesLimited", description: "Fixed move budget; level-ups grant extra moves. Survival-style.", primaryMetric: "movesRemaining at game-over" },
  { name: "wilds", description: "Wildcard tiles match any value; beast tiles spawn periodically and rampage on a danger countdown.", primaryMetric: "levelsCleared", notes: "Beast kills produce unbounded peak/score (chain-multiplier × beast value scales geometrically). Phase 0 baseline runs at maxMoves=300 to keep numbers human-scale." },
];

export type AlgoEntry = {
  name: string;
  description: string;
  configurableParams: string[];
};

export const ALGOS: AlgoEntry[] = [
  { name: "weighted", description: "Spawn distribution weighted toward smaller values via a default curve [0.4, 0.3, 0.2, 0.1] + geometric tail.", configurableParams: [] },
  { name: "antiPair", description: "Down-weights spawn values that would create matching neighbours (1 + strength × pairCount).", configurableParams: ["strength (default 2.5)"] },
  { name: "adversarial", description: "Scores each pool value by resulting board hostility, then softmax-samples from top-K=3 candidates.", configurableParams: ["softness (default 0; >0 reverts to weighted with that probability)"] },
];

// Sanity check at module load that schema lists stay in sync with the engine.
if (process.env.HARNESS_SCHEMA_LINT) {
  const modeNames = new Set(MODES.map((m) => m.name));
  for (const m of ALL_MODES) if (!modeNames.has(m)) throw new Error(`schema.ts MODES missing "${m}"`);
  const algoNames = new Set(ALGOS.map((a) => a.name));
  for (const a of ALL_ALGOS) if (!algoNames.has(a)) throw new Error(`schema.ts ALGOS missing "${a}"`);
}

export type DescribeTopic = "metrics" | "bots" | "modes" | "algos" | "all";

export function describe(topic: DescribeTopic) {
  switch (topic) {
    case "metrics": return { schema: "harness-describe", topic: "metrics", entries: METRICS };
    case "bots": return { schema: "harness-describe", topic: "bots", entries: BOTS };
    case "modes": return { schema: "harness-describe", topic: "modes", entries: MODES };
    case "algos": return { schema: "harness-describe", topic: "algos", entries: ALGOS };
    case "all": return {
      schema: "harness-describe",
      topic: "all",
      metrics: METRICS,
      bots: BOTS,
      modes: MODES,
      algos: ALGOS,
    };
  }
}
