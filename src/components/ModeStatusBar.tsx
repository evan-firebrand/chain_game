import type { GameState, LevelGoal } from "../game/types";

type Props = {
  state: GameState;
};

function goalText(goal: LevelGoal, met: boolean): string {
  if (goal.kind === "chain-length") {
    const progress = `${goal.best}/${goal.target}`;
    return met ? `Goal: chain ${goal.target}+ ✓` : `Goal: chain ${goal.target}+ (best ${progress})`;
  }
  const label = goal.target >= 1024 ? `${goal.target / 1024}k` : String(goal.target);
  return met ? `Goal: produce ${label} ✓` : `Goal: produce a ${label}`;
}

export function ModeStatusBar({ state }: Props) {
  if (state.mode === "risingFloor" && state.modeState.kind === "risingFloor") {
    const { floor, movesToRaise } = state.modeState;
    if (movesToRaise <= 1) {
      return (
        <div className="mode-status mode-status-critical">
          <span className="mode-status-hint">
            Floor rises next move — clear your {floor}s! Queue will reset.
          </span>
        </div>
      );
    }
    if (movesToRaise <= 3) {
      return (
        <div className="mode-status mode-status-warn">
          <span className="mode-status-hint">
            Floor rises in {movesToRaise} — clear your {floor}s
          </span>
        </div>
      );
    }
    return null;
  }

  if (state.mode === "wilds" && state.modeState.kind === "wilds") {
    const { movesUntilBeast, frenzyRemaining, activeBeastIds } = state.modeState;
    if (frenzyRemaining > 0) {
      return (
        <div className="mode-status mode-status-wilds-frenzy">
          <span className="mode-status-hint">
            Wild Frenzy · all spawns wild for {frenzyRemaining} more · 1.5× chains
          </span>
        </div>
      );
    }
    if (activeBeastIds.length > 0) {
      return (
        <div className="mode-status mode-status-wilds">
          <span className="mode-status-hint">
            {activeBeastIds.length} beast{activeBeastIds.length > 1 ? "s" : ""} on the hunt — chain 3+ to defeat
          </span>
        </div>
      );
    }
    if (movesUntilBeast <= 2) {
      return (
        <div className="mode-status mode-status-critical">
          <span className="mode-status-hint">
            Beast spawns {movesUntilBeast === 1 ? "next move" : `in ${movesUntilBeast}`}
          </span>
        </div>
      );
    }
    return null;
  }

  if (state.levelGoal) {
    const met = state.levelGoalMet;
    return (
      <div className={`mode-status ${met ? "mode-status-goal-met" : "mode-status-goal"}`}>
        <span className="mode-status-hint">{goalText(state.levelGoal, met)}</span>
      </div>
    );
  }

  return null;
}
