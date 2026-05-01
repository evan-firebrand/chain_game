import type { GameState, LevelGoal } from "../game/types";

type Props = {
  state: GameState;
};

type Banner = { className: string; text: string };

function goalText(goal: LevelGoal, met: boolean): string {
  if (goal.kind === "chain-length") {
    const progress = `${goal.best}/${goal.target}`;
    return met ? `Goal: chain ${goal.target}+ ✓` : `Goal: chain ${goal.target}+ (best ${progress})`;
  }
  const label = goal.target >= 1024 ? `${goal.target / 1024}k` : String(goal.target);
  return met ? `Goal: produce ${label} ✓` : `Goal: produce a ${label}`;
}

function modeBanner(state: GameState): Banner | null {
  if (state.mode === "risingFloor" && state.modeState.kind === "risingFloor") {
    const { floor, movesToRaise } = state.modeState;
    if (movesToRaise <= 1) {
      return {
        className: "mode-status mode-status-critical",
        text: `Floor rises next move — clear your ${floor}s! Queue will reset.`,
      };
    }
    if (movesToRaise <= 3) {
      return {
        className: "mode-status mode-status-warn",
        text: `Floor rises in ${movesToRaise} — clear your ${floor}s`,
      };
    }
    return null;
  }
  if (state.mode === "wilds" && state.modeState.kind === "wilds") {
    const { movesUntilBeast, frenzyRemaining, activeBeastIds } = state.modeState;
    if (frenzyRemaining > 0) {
      return {
        className: "mode-status mode-status-wilds-frenzy",
        text: `Wild Frenzy · all spawns wild for ${frenzyRemaining} more · 1.5× chains`,
      };
    }
    if (activeBeastIds.length > 0) {
      return {
        className: "mode-status mode-status-wilds",
        text: `${activeBeastIds.length} beast${activeBeastIds.length > 1 ? "s" : ""} on the hunt — chain 3+ to defeat`,
      };
    }
    if (movesUntilBeast <= 2) {
      return {
        className: "mode-status mode-status-critical",
        text: `Beast spawns ${movesUntilBeast === 1 ? "next move" : `in ${movesUntilBeast}`}`,
      };
    }
    return null;
  }
  return null;
}

function goalBanner(state: GameState): Banner | null {
  if (!state.levelGoal) return null;
  const met = state.levelGoalMet;
  return {
    className: `mode-status ${met ? "mode-status-goal-met" : "mode-status-goal"}`,
    text: goalText(state.levelGoal, met),
  };
}

export function ModeStatusBar({ state }: Props) {
  const mode = modeBanner(state);
  const goal = goalBanner(state);
  if (!mode && !goal) return null;
  return (
    <div className="mode-status-stack">
      {mode && (
        <div className={mode.className}>
          <span className="mode-status-hint">{mode.text}</span>
        </div>
      )}
      {goal && (
        <div className={goal.className}>
          <span className="mode-status-hint">{goal.text}</span>
        </div>
      )}
    </div>
  );
}
