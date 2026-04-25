import { Board } from "../components/Board";
import { ComboOverlay } from "../components/ComboOverlay";
import { FrenzyBanner } from "../components/FrenzyBanner";
import { HealthBanner } from "../components/HealthBanner";
import { Hud } from "../components/Hud";
import { LevelUpOverlay } from "../components/LevelUpOverlay";
import { ModeStatusBar } from "../components/ModeStatusBar";
import { PostMortem } from "../components/PostMortem";
import { SpawnQueue } from "../components/SpawnQueue";
import { SpiritMeter } from "../components/SpiritMeter";
import { TrophyFlash } from "../components/TrophyFlash";
import { RAISE_INTERVAL } from "../game/modes/risingFloor";
import { WILDS_CONSTANTS } from "../game/modes/wilds";
import { healthFromPairs } from "../game/health";
import type { GameController } from "../hooks/useGameController";
import type { Settings } from "../hooks/useSettingsPersistence";

type Props = {
  ctrl: GameController;
  settings: Settings;
};

export function GameView({ ctrl, settings }: Props) {
  const { state, animator, tileClass, isAnimating, actions } = ctrl;
  const latestPairs = state.recentStartCounts[state.recentStartCounts.length - 1] ?? 0;
  const wildsState =
    state.mode === "wilds" && state.modeState.kind === "wilds" ? state.modeState : null;

  return (
    <div className="app-main">
      <Hud
        score={state.score}
        peak={state.peak}
        moves={state.moves}
        level={state.levelsCleared}
        target={state.currentTarget}
        pairs={latestPairs}
        undoCharges={state.undoCharges}
        canUndo={state.undoStack.length > 0 && state.undoCharges > 0 && !isAnimating && !state.gameOver}
        onUndo={actions.undo}
        targetsEnabled={state.targetsEnabled}
        onRestart={actions.restart}
        onBackToMenu={actions.backToMenu}
        mode={state.mode}
        risingFloor={
          state.mode === "risingFloor" && state.modeState.kind === "risingFloor"
            ? { floor: state.modeState.floor, movesToRaise: state.modeState.movesToRaise, raiseInterval: RAISE_INTERVAL }
            : undefined
        }
      />

      <ModeStatusBar state={state} />

      {wildsState && <FrenzyBanner remaining={wildsState.frenzyRemaining} />}

      <div className="play-area">
        <SpawnQueue
          queue={state.spawnQueue}
          previewCount={settings.blindfoldEnabled ? 0 : settings.queueDepth}
        />
        <Board
          grid={state.grid}
          disabled={state.gameOver || isAnimating}
          onCommit={actions.commit}
          displayGrid={animator.displayGrid}
          flyingTiles={animator.flyingTiles}
          landingId={animator.landingId}
          shakeIntensity={animator.shakeIntensity}
          spawningIds={animator.spawningIds}
          phase={animator.phase}
          pairs={latestPairs}
          deadIds={tileClass.dead}
          trophyIds={tileClass.trophy}
          fragileIds={tileClass.fragile}
          strandedIds={tileClass.stranded}
        />
        {wildsState && (
          <div className="play-area-wilds-side">
            <SpiritMeter
              spirit={wildsState.spirit}
              cap={WILDS_CONSTANTS.SPIRIT_CAP}
              waveCost={WILDS_CONSTANTS.SPIRIT_WAVE_COST}
              frenzyActive={wildsState.frenzyRemaining > 0}
              frenzyRemaining={wildsState.frenzyRemaining}
              onActivateWave={actions.activateSpiritWave}
              disabled={state.gameOver || isAnimating}
            />
          </div>
        )}
        {state.targetsEnabled && <LevelUpOverlay lastLevelUp={state.lastLevelUp} />}
        <ComboOverlay lastMerge={state.lastMerge} />
        <HealthBanner currentHealth={healthFromPairs(latestPairs)} />
        {wildsState && <TrophyFlash flash={wildsState.lastTrophyFlash} />}
      </div>

      <p className="hint">
        Start a chain with <em>two equal tiles</em> (e.g. 4 &rarr; 4). After that, each
        next tile must <em>equal or double</em> the previous tile in the chain. Game
        over when no two adjacent tiles are equal. Press <kbd>`</kbd> for dev metrics.
      </p>

      {state.gameOver && !isAnimating && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            <h2>Game Over</h2>
            <div className="game-over-stats">
              {state.targetsEnabled && (
                <div className="game-over-level">
                  <strong>{state.levelsCleared}</strong>
                  <span>Level reached{state.levelsCleared > 0 ? ` (${state.currentTarget / 2})` : ""}</span>
                </div>
              )}
              <div>
                <strong>{state.peak}</strong>
                <span>Peak tile</span>
              </div>
              <div>
                <strong>{state.moves}</strong>
                <span>Moves</span>
              </div>
              <div>
                <strong>{state.score.toLocaleString()}</strong>
                <span>Score</span>
              </div>
            </div>
            <PostMortem recentStartCounts={state.recentStartCounts} moves={state.moves} />
            <div className="game-over-actions">
              <button className="btn btn-primary" onClick={actions.restart}>
                New run
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => actions.newRunWithSeed(state.seed)}
                title="Replay this same seed"
              >
                Replay seed {state.seed}
              </button>
              <button className="btn btn-ghost" onClick={actions.backToMenu}>
                Change mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
