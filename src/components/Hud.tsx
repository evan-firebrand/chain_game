import { healthFromPairs } from "../game/health";

type Props = {
  score: number;
  peak: number;
  moves: number;
  level: number;
  target: number;
  pairs: number;
  undoCharges: number;
  canUndo: boolean;
  onUndo: () => void;
  targetsEnabled: boolean;
  onRestart: () => void;
  onBackToMenu: () => void;
  mode?: string;
  risingFloor?: { floor: number; movesToRaise: number; raiseInterval: number };
};

export function Hud({
  score,
  peak,
  moves,
  level,
  target,
  pairs,
  undoCharges,
  canUndo,
  onUndo,
  targetsEnabled,
  onRestart,
  onBackToMenu,
  mode,
  risingFloor,
}: Props) {
  const isRisingFloor = mode === "risingFloor" && risingFloor != null;

  return (
    <header className="app-header">
      <div className="header-top">
        <h1 className="app-title">2248</h1>
        <div className="hud-actions">
          <button onClick={onBackToMenu} className="btn btn-ghost" title="Back to mode select">
            ← Menu
          </button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn btn-ghost"
            title="Undo your last move — recharges on level-up"
          >
            ↶ Undo <span className="undo-charges">{undoCharges}</span>
          </button>
          <button onClick={onRestart} className="btn btn-primary">
            New run
          </button>
        </div>
      </div>

      <div className="header-stats">
        {isRisingFloor ? (
          <>
            {targetsEnabled && <LevelStat level={level} />}
            {targetsEnabled && <TargetStat peak={peak} target={target} />}
            <FloorStat
              floor={risingFloor.floor}
              movesToRaise={risingFloor.movesToRaise}
              raiseInterval={risingFloor.raiseInterval}
            />
            <MovesStat moves={moves} />
            <PairsStat pairs={pairs} />
          </>
        ) : targetsEnabled ? (
          <>
            <LevelStat level={level} />
            <TargetStat peak={peak} target={target} />
            <MovesStat moves={moves} />
            <PairsStat pairs={pairs} />
          </>
        ) : (
          <>
            <SimpleStat label="Score" value={score.toLocaleString()} />
            <SimpleStat label="Peak" value={peak.toString()} />
            <MovesStat moves={moves} />
            <PairsStat pairs={pairs} />
          </>
        )}
      </div>
    </header>
  );
}

function SimpleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function LevelStat({ level }: { level: number }) {
  return (
    <div className="stat stat-level">
      <div className="stat-label">Level</div>
      <div className="stat-value">{level}</div>
    </div>
  );
}

function MovesStat({ moves }: { moves: number }) {
  return (
    <div className="stat stat-moves">
      <div className="stat-label">Moves</div>
      <div className="stat-value">{moves}</div>
    </div>
  );
}

function TargetStat({ peak, target }: { peak: number; target: number }) {
  const pct = Math.max(0, Math.min(100, (peak / target) * 100));
  return (
    <div className="stat stat-target">
      <div className="stat-label">Target</div>
      <div className="stat-value">{target}</div>
      <div className="stat-progress">
        <div className="stat-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FloorStat({
  floor,
  movesToRaise,
  raiseInterval,
}: {
  floor: number;
  movesToRaise: number;
  raiseInterval: number;
}) {
  const urgency =
    movesToRaise <= 1 ? "critical" : movesToRaise <= 3 ? "warn" : "ok";
  const timerPct = Math.max(0, Math.min(100, (movesToRaise / raiseInterval) * 100));
  const countdownText =
    movesToRaise <= 1 ? "↑ next move!" : `↑ in ${movesToRaise}`;
  const cls = `stat stat-floor${urgency === "ok" ? "" : ` stat-floor-${urgency}`}`;
  return (
    <div
      className={cls}
      title={`Spawn floor rises to ${floor * 2} in ${movesToRaise} ${movesToRaise === 1 ? "move" : "moves"}`}
    >
      <div className="stat-label">Floor</div>
      <div className="floor-body">
        <span className="floor-value">{floor}</span>
        <span className="floor-countdown">{countdownText}</span>
      </div>
      <div className="floor-timer">
        <div className="floor-timer-fill" style={{ width: `${timerPct}%` }} />
      </div>
    </div>
  );
}

function PairsStat({ pairs }: { pairs: number }) {
  const health = healthFromPairs(pairs);
  return (
    <div
      className={`stat stat-pairs stat-pairs-${health}`}
      title="Adjacent equal pairs on the board — when this hits 0, the game is over"
    >
      <div className="stat-label">Pairs</div>
      <div className="stat-value">{pairs}</div>
    </div>
  );
}
