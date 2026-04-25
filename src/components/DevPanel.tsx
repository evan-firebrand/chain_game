import { useMemo, useState } from "react";
import type { GameMode, GameState, SpawnAlgo, Telemetry } from "../game/types";
import { ALL_ALGOS, ALL_MODES, MODE_LABELS, algoUsesSoftness, algoUsesStrength } from "../game/types";
import { appendRun, clearRuns, readRuns, summarize } from "../game/runLog";
import type { RunEntry } from "../game/runLog";
import { benchmark, sweep } from "../game/bot";
import type { BenchmarkSummary, BotPolicy } from "../game/bot";
import { computeMoveSpace } from "../game/moveSpace";
import { getSandboxRate, setSandboxRate } from "../game/modifiers/sandbox";

type Props = {
  state: GameState;
  telemetry: Telemetry;
  elapsedSec: number;
  onNewRunWithSeed: (seed: number) => void;
  algo: SpawnAlgo;
  queueDepth: number;
  strength: number;
  softness: number;
  mode: GameMode;
  targetsEnabled: boolean;
  ratchetEnabled: boolean;
  boardRows: number;
  boardCols: number;
  poolSize: number;
  onChangeAlgo: (algo: SpawnAlgo) => void;
  onChangeQueueDepth: (depth: number) => void;
  onChangeStrength: (strength: number) => void;
  onChangeSoftness: (softness: number) => void;
  onChangeMode: (mode: GameMode) => void;
  onChangeTargetsEnabled: (enabled: boolean) => void;
  onChangeRatchetEnabled: (enabled: boolean) => void;
  onChangeBoardSize: (rows: number, cols: number) => void;
  onChangePoolSize: (size: number) => void;
  onResetDefaults: () => void;
  runs: RunEntry[];
  onRunsChanged: () => void;
  onStampModifiers?: (ratio?: number) => void;
};

const QUEUE_DEPTH_OPTIONS = [0, 1, 2, 4, 8];
const HOSTILITY_LABELS: Record<SpawnAlgo, string> = {
  weighted: "Neutral",
  antiPair: "Weighted",
  adversarial: "Hostile",
};
const HOSTILITY_ORDER: SpawnAlgo[] = ["weighted", "antiPair", "adversarial"];
const STRENGTH_OPTIONS = [0, 0.5, 1, 2.5, 5, 10, 20];
const SOFTNESS_OPTIONS = [0, 0.1, 0.2, 0.3, 0.5, 1];
const DEFAULT_STRENGTH_SWEEP = "0, 0.5, 1, 2.5, 5, 10, 20";
const DEFAULT_SOFTNESS_SWEEP = "0, 0.1, 0.2, 0.3, 0.5, 1";

function parseStrengths(s: string): number[] {
  return s
    .split(/[\s,]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

function formatBigNumber(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

export function DevPanel({
  state,
  telemetry,
  elapsedSec,
  onNewRunWithSeed,
  algo,
  queueDepth,
  strength,
  softness,
  mode,
  targetsEnabled,
  ratchetEnabled,
  boardRows,
  boardCols,
  poolSize,
  onChangeAlgo,
  onChangeQueueDepth,
  onChangeStrength,
  onChangeSoftness,
  onChangeMode,
  onChangeTargetsEnabled,
  onChangeRatchetEnabled,
  onChangeBoardSize,
  onChangePoolSize,
  onResetDefaults,
  runs,
  onRunsChanged,
  onStampModifiers,
}: Props) {
  const [sandboxRate, setSandboxRateState] = useState<number>(() => getSandboxRate());
  const [seedInput, setSeedInput] = useState<string>("");
  const [benchN, setBenchN] = useState<number>(10);
  const [benchPolicy, setBenchPolicy] = useState<BotPolicy>("greedy");
  const [benching, setBenching] = useState(false);
  const [benchResult, setBenchResult] = useState<BenchmarkSummary[] | null>(null);
  const [hideBotRuns, setHideBotRuns] = useState(false);

  const [sweepValues, setSweepValues] = useState<string>(DEFAULT_STRENGTH_SWEEP);
  const [sweepN, setSweepN] = useState<number>(10);
  const [sweepAlgo, setSweepAlgoRaw] = useState<SpawnAlgo>("antiPair");
  const [sweepPolicy, setSweepPolicy] = useState<BotPolicy>("greedy");
  const setSweepAlgo = (a: SpawnAlgo) => {
    setSweepAlgoRaw(a);
    setSweepValues(algoUsesSoftness(a) ? DEFAULT_SOFTNESS_SWEEP : DEFAULT_STRENGTH_SWEEP);
  };
  const sweepParam: "strength" | "softness" = algoUsesSoftness(sweepAlgo)
    ? "softness"
    : "strength";
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<BenchmarkSummary[] | null>(null);

  const histogramEntries = Object.entries(telemetry.histogram)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const pairBreakdown = Object.entries(telemetry.pairBreakdown).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  const visibleRuns = useMemo(
    () => (hideBotRuns ? runs.filter((r) => !r.isBot) : runs),
    [runs, hideBotRuns]
  );
  const runSummaries = useMemo(() => summarize(visibleRuns), [visibleRuns]);

  const persistBotRuns = (summaries: BenchmarkSummary[]) => {
    for (const s of summaries) {
      for (const r of s.runs) {
        appendRun({
          algo: r.algo,
          seed: r.seed,
          moves: r.moves,
          peak: r.peak,
          score: r.score,
          queueDepth: 0,
          endedAt: Date.now(),
          isBot: true,
        });
      }
    }
    onRunsChanged();
  };

  const runBenchmark = async () => {
    setBenching(true);
    setBenchResult(null);
    await new Promise((r) => setTimeout(r, 20));
    try {
      const result = benchmark(ALL_ALGOS, Math.max(1, Math.min(200, benchN)), {
        strength,
        softness,
        mode,
        policy: benchPolicy,
      });
      setBenchResult(result);
      persistBotRuns(result);
    } finally {
      setBenching(false);
    }
  };

  const runSweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    await new Promise((r) => setTimeout(r, 20));
    try {
      const values = parseStrengths(sweepValues);
      if (values.length === 0) return;
      const result = sweep(
        sweepAlgo,
        sweepParam,
        values,
        Math.max(1, Math.min(200, sweepN)),
        sweepPolicy,
        mode
      );
      setSweepResult(result);
      persistBotRuns(result);
    } finally {
      setSweeping(false);
    }
  };

  const sweepSparkline = useMemo(() => {
    if (!sweepResult) return "";
    return sweepResult
      .map((r) => {
        const v = sweepParam === "softness" ? r.softness : r.strength;
        return `${v}\u2192${r.medianMoves.toFixed(0)}`;
      })
      .join(" \u00b7 ");
  }, [sweepResult, sweepParam]);

  // Move-space stats derived from the current state. Heavy: calls canBeConsumed
  // per tile at K=1 and K=2. Recomputes on any state change — fine because the
  // dev panel is only mounted when devOpen is true.
  const moveSpace = useMemo(() => computeMoveSpace(state), [state]);

  return (
    <aside className="dev-panel">
      <div className="dev-header">
        <h3>Dev Metrics</h3>
        <button
          type="button"
          className="btn btn-ghost dev-reset-btn"
          onClick={onResetDefaults}
          title="Reset all tunables (algo, strength, softness, queueDepth, targets, Hard Mode, Blindfold) and start a fresh run"
        >
          Reset defaults
        </button>
      </div>

      <Section title="Strategy">
        <div className="dev-row">
          <span className="dev-row-k">Mode</span>
          <select
            className="dev-select"
            value={mode}
            onChange={(e) => onChangeMode(e.target.value as GameMode)}
          >
            {ALL_MODES.map((m) => (
              <option key={m} value={m}>{MODE_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Targets</span>
          <label className="dev-toggle-label">
            <input
              type="checkbox"
              checked={targetsEnabled}
              onChange={(e) => onChangeTargetsEnabled(e.target.checked)}
            />
            <span>{targetsEnabled ? "on" : "off"}</span>
          </label>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Ratchet</span>
          <label className="dev-toggle-label">
            <input
              type="checkbox"
              checked={ratchetEnabled}
              disabled={!targetsEnabled}
              onChange={(e) => onChangeRatchetEnabled(e.target.checked)}
            />
            <span>{ratchetEnabled ? "on" : "off"}</span>
          </label>
        </div>
        <div className="dev-row">
          <span className="dev-row-k" title="How adversarial spawn RNG is. Neutral = uniform weighted; Weighted = avoids creating pairs near landing; Hostile = top-K worst spawn for the player.">Hostility</span>
          <div className="dev-chips">
            {HOSTILITY_ORDER.map((a) => (
              <button
                key={a}
                type="button"
                className={`dev-chip${algo === a ? " dev-chip-active" : ""}`}
                onClick={() => onChangeAlgo(a)}
              >
                {HOSTILITY_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
        <div className="dev-row">
          <span className="dev-row-k" title="How many upcoming spawns are visible. 0 = blind; higher = more planning room.">Visibility</span>
          <div className="dev-chips">
            {QUEUE_DEPTH_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={`dev-chip${queueDepth === d ? " dev-chip-active" : ""}`}
                onClick={() => onChangeQueueDepth(d)}
              >
                {d === 0 ? "blind" : d}
              </button>
            ))}
          </div>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Strength</span>
          <select
            className="dev-select"
            value={strength}
            disabled={!algoUsesStrength(algo)}
            onChange={(e) => onChangeStrength(Number(e.target.value))}
          >
            {STRENGTH_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Softness</span>
          <select
            className="dev-select"
            value={softness}
            disabled={!algoUsesSoftness(algo)}
            onChange={(e) => onChangeSoftness(Number(e.target.value))}
          >
            {SOFTNESS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Run">
        <Row k="Score" v={state.score.toLocaleString()} />
        <Row k="Moves" v={state.moves.toString()} />
        <Row k="Merges" v={state.merges.toString()} />
        <Row k="Elapsed" v={`${elapsedSec.toFixed(0)}s`} />
        <Row k="Seed" v={state.seed.toString()} copy />
      </Section>

      <Section title="Modifier sandbox">
        <div className="dev-row">
          <span className="dev-row-k">Spawn rate</span>
          <div className="dev-chips">
            {[0, 0.15, 0.3, 0.5, 1].map((r) => (
              <button
                key={r}
                type="button"
                className={`dev-chip${sandboxRate === r ? " dev-chip-active" : ""}`}
                onClick={() => {
                  setSandboxRate(r);
                  setSandboxRateState(r);
                }}
              >
                {Math.round(r * 100)}%
              </button>
            ))}
          </div>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Stamp board</span>
          <div className="dev-chips">
            {onStampModifiers && (
              <>
                <button type="button" className="dev-chip" onClick={() => onStampModifiers(0.15)}>
                  Light
                </button>
                <button type="button" className="dev-chip" onClick={() => onStampModifiers(0.3)}>
                  Medium
                </button>
                <button type="button" className="dev-chip" onClick={() => onStampModifiers(0.5)}>
                  Heavy
                </button>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Board config (restarts run)">
        <div className="dev-row">
          <span className="dev-row-k">Size</span>
          <select
            className="dev-select"
            value={`${boardCols}x${boardRows}`}
            onChange={(e) => {
              const [c, r] = e.target.value.split("x").map(Number);
              onChangeBoardSize(r, c);
            }}
          >
            <option value="5x7">5×7 (default)</option>
            <option value="6x8">6×8</option>
            <option value="6x9">6×9</option>
            <option value="7x9">7×9</option>
            <option value="8x10">8×10</option>
          </select>
        </div>
        <div className="dev-row">
          <span className="dev-row-k">Pool size</span>
          <select
            className="dev-select"
            value={poolSize}
            onChange={(e) => onChangePoolSize(Number(e.target.value))}
          >
            {[4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Difficulty">
        <Row k="Peak" v={telemetry.peak.toString()} />
        <Row k="Spawn pool" v={telemetry.spawnPool.join(", ")} />
        <Row
          k={
            algo === "antiPair"
              ? "Weights (avg, live)"
              : algo === "adversarial"
              ? "Col picks (live)"
              : "Weights"
          }
          v={telemetry.spawnPool
            .map((v, i) => `${v}:${(telemetry.spawnWeights[i] * 100).toFixed(0)}%`)
            .join(", ")}
        />
      </Section>

      <Section title="Board">
        <Row
          k="Chain starts"
          v={telemetry.chainStarts.toString()}
          highlight={telemetry.chainStarts <= 2}
        />
        <Row
          k="Extensions"
          v={telemetry.chainExtensions.toString()}
        />
        <Row
          k="Starts trajectory"
          v={telemetry.recentStartCounts.join(" \u2192 ")}
        />
        <div className="dev-subsection">
          <div className="dev-subsection-title">Tile histogram</div>
          <div className="dev-histogram">
            {histogramEntries.map(([v, count]) => (
              <div key={v} className="dev-hist-row">
                <span className="dev-hist-val">{v}</span>
                <div
                  className="dev-hist-bar"
                  style={{ width: `${Math.min(count * 8, 100)}%` }}
                />
                <span className="dev-hist-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
        {pairBreakdown.length > 0 && (
          <div className="dev-subsection">
            <div className="dev-subsection-title">Pair breakdown</div>
            <ul className="dev-list">
              {pairBreakdown.map(([k, count]) => (
                <li key={k}>
                  <span>{k}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Move space">
        <Row
          k="Legal chains"
          v={`${moveSpace.totalChains}${moveSpace.capped ? " (capped)" : ""}`}
        />
        <Row
          k="Length dist"
          v={`2:${moveSpace.len2} 3:${moveSpace.len3} 4:${moveSpace.len4} 5+:${moveSpace.len5Plus}`}
        />
        <Row
          k="Orphan rate"
          v={`${moveSpace.orphanRatePct.toFixed(1)}%`}
          highlight={moveSpace.orphanRatePct >= 50}
        />
        <Row
          k="Chain quality"
          v={moveSpace.chainQuality.toFixed(1)}
        />
        <div className="dev-subsection">
          <div className="dev-subsection-title">Tile status ({moveSpace.totalTiles} tiles)</div>
          <Row k="Consumable K=1" v={moveSpace.consumableK1.toString()} />
          <Row k="Consumable K=2" v={moveSpace.consumableK2.toString()} />
          <Row
            k="Truly dead"
            v={moveSpace.trulyDead.toString()}
            highlight={moveSpace.trulyDead > 0}
          />
        </div>
        {moveSpace.resultDist.length > 0 && (
          <div className="dev-subsection">
            <div className="dev-subsection-title">Result values (from all chains)</div>
            <ul className="dev-list">
              {moveSpace.resultDist.map(({ value, count }) => (
                <li key={value}>
                  <span>{value}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Spawn queue (by column)">
        <ol className="dev-queue">
          {state.spawnQueue.map((col, i) => (
            <li key={i}>
              col {i}: [{col.join(", ")}]
            </li>
          ))}
        </ol>
      </Section>

      {telemetry.lastMerge && (
        <Section title="Last merge">
          <Row k="Chain" v={telemetry.lastMerge.chainValues.join(" + ")} />
          <Row k="Sum" v={telemetry.lastMerge.sum.toString()} />
          <Row k="Result" v={telemetry.lastMerge.result.toString()} />
          <Row
            k="Landing"
            v={`r${telemetry.lastMerge.landing.r} c${telemetry.lastMerge.landing.c}`}
          />
        </Section>
      )}

      <Section title="Benchmark (bot)">
        <div className="dev-bench-controls">
          <label className="dev-row-k">N</label>
          <input
            type="number"
            min={1}
            max={200}
            value={benchN}
            onChange={(e) => setBenchN(Number(e.target.value))}
          />
          <select
            className="dev-select"
            value={benchPolicy}
            onChange={(e) => setBenchPolicy(e.target.value as BotPolicy)}
          >
            <option value="greedy">greedy</option>
            <option value="lookahead1">lookahead1</option>
          </select>
          <button
            className="btn btn-ghost"
            onClick={runBenchmark}
            disabled={benching}
          >
            {benching ? "Running..." : "Run"}
          </button>
        </div>
        {benchResult && (
          <table className="dev-table">
            <thead>
              <tr>
                <th>Algo</th>
                <th>Med Lvl</th>
                <th>Max Lvl</th>
                <th>Med mv</th>
                <th>Avg len</th>
              </tr>
            </thead>
            <tbody>
              {benchResult.map((s) => (
                <tr key={s.algo}>
                  <td>{s.algo}</td>
                  <td>{s.medianLevels.toFixed(1)}</td>
                  <td>{s.maxLevels}</td>
                  <td>{s.medianMoves.toFixed(0)}</td>
                  <td>{s.avgChainLen.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Sweep (${sweepParam})`}>
        <div className="dev-bench-controls">
          <select
            className="dev-select"
            value={sweepAlgo}
            onChange={(e) => setSweepAlgo(e.target.value as SpawnAlgo)}
          >
            {ALL_ALGOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            className="dev-select"
            value={sweepPolicy}
            onChange={(e) => setSweepPolicy(e.target.value as BotPolicy)}
          >
            <option value="greedy">greedy</option>
            <option value="lookahead1">lookahead1</option>
          </select>
          <label className="dev-row-k">N</label>
          <input
            type="number"
            min={1}
            max={200}
            value={sweepN}
            onChange={(e) => setSweepN(Number(e.target.value))}
          />
        </div>
        <div className="dev-bench-controls">
          <input
            type="text"
            value={sweepValues}
            onChange={(e) => setSweepValues(e.target.value)}
            placeholder={`${sweepParam}, comma-separated`}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-ghost"
            onClick={runSweep}
            disabled={sweeping}
          >
            {sweeping ? "Running..." : "Run"}
          </button>
        </div>
        {sweepResult && (
          <>
            <div className="dev-sparkline">{sweepSparkline}</div>
            <table className="dev-table">
              <thead>
                <tr>
                  <th>{sweepParam === "softness" ? "Soft" : "Str"}</th>
                  <th>Med Lvl</th>
                  <th>Med mv</th>
                  <th>Avg len</th>
                  <th>Pk @50</th>
                </tr>
              </thead>
              <tbody>
                {sweepResult.map((s) => {
                  const v = sweepParam === "softness" ? s.softness : s.strength;
                  return (
                    <tr key={v}>
                      <td>{v}</td>
                      <td>{s.medianLevels.toFixed(1)}</td>
                      <td>{s.medianMoves.toFixed(0)}</td>
                      <td>{s.avgChainLen.toFixed(2)}</td>
                      <td>{formatBigNumber(s.avgPeakByMove50)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </Section>

      <Section title={`Runs (${visibleRuns.length})`}>
        <div className="dev-bench-controls">
          <label className="dev-row-k">
            <input
              type="checkbox"
              checked={hideBotRuns}
              onChange={(e) => setHideBotRuns(e.target.checked)}
            />
            {" "}Hide bot
          </label>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearRuns();
              onRunsChanged();
            }}
          >
            Clear
          </button>
        </div>
        {runSummaries.length > 0 && (
          <table className="dev-table">
            <thead>
              <tr>
                <th>Algo</th>
                <th>N</th>
                <th>Med moves</th>
                <th>Avg score</th>
              </tr>
            </thead>
            <tbody>
              {runSummaries.map((s) => (
                <tr key={s.algo}>
                  <td>{s.algo}</td>
                  <td>{s.count}</td>
                  <td>{s.medianMoves.toFixed(0)}</td>
                  <td>{formatBigNumber(s.avgScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {visibleRuns.length > 0 && (
          <div className="dev-runs-list">
            {visibleRuns.slice(0, 20).map((r, i) => (
              <div key={i} className="dev-run-row">
                <span className={`dev-run-tag dev-run-tag-${r.algo}`}>{r.algo}</span>
                {r.isBot && <span className="dev-run-bot">bot</span>}
                <span>{r.moves}m</span>
                <span>pk {formatBigNumber(r.peak)}</span>
                <span>{formatBigNumber(r.score)}</span>
                <button
                  className="btn-copy"
                  onClick={() => onNewRunWithSeed(r.seed)}
                  title="Replay seed"
                >
                  ↻
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Replay seed">
        <div className="dev-seed-row">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Paste a seed..."
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
          />
          <button
            className="btn btn-ghost"
            onClick={() => {
              const n = Number(seedInput);
              if (Number.isFinite(n) && n >= 0) onNewRunWithSeed(n >>> 0);
            }}
          >
            Go
          </button>
        </div>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dev-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Row({
  k,
  v,
  copy,
  highlight,
}: {
  k: string;
  v: string;
  copy?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`dev-row${highlight ? " dev-row-alert" : ""}`}>
      <span className="dev-row-k">{k}</span>
      <span className="dev-row-v">
        {v}
        {copy && (
          <button
            className="btn-copy"
            onClick={() => navigator.clipboard?.writeText(v)}
            title="Copy"
          >
            ⧉
          </button>
        )}
      </span>
    </div>
  );
}

export { readRuns };
