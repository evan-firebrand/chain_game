import { useState } from "react";
import type { GameMode } from "../game/types";
import { ALL_MODES, MODE_LABELS } from "../game/types";
import { readTrophyWall } from "../game/trophyWall";

const MODE_DESCRIPTIONS: Record<GameMode, string> = {
  classic: "Pure chain-building. Reach the target, level up, repeat.",
  risingFloor: "Spawns get bigger every 10 moves. Keep your peak ahead.",
  boost: "Gold tiles appear occasionally. Route chains through them to double the merge.",
  movesLimited: "50 moves. Score as high as possible — no survival, pure efficiency.",
  wilds: "Wildcards substitute. Beasts hunt your tiles. Build the spirit meter to fight back.",
};

type Props = {
  mode: GameMode;
  ratchetEnabled: boolean;
  blindfoldEnabled: boolean;
  onSelectMode: (mode: GameMode) => void;
  onToggleRatchet: (enabled: boolean) => void;
  onToggleBlindfold: (enabled: boolean) => void;
  onStart: () => void;
  onOpenScenarios: () => void;
  onOpenRoadmap: () => void;
};

export function ModeSelect({
  mode,
  ratchetEnabled,
  blindfoldEnabled,
  onSelectMode,
  onToggleRatchet,
  onToggleBlindfold,
  onStart,
  onOpenScenarios,
  onOpenRoadmap,
}: Props) {
  const [trophy] = useState(() => readTrophyWall());

  return (
    <div className="mode-select">
      <div className="mode-select-inner">
        <h1 className="mode-select-title">2248</h1>
        <p className="mode-select-subtitle">Chain tiles, reach the target, climb.</p>

        <div className="mode-cards">
          {ALL_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`mode-card${m === mode ? " mode-card-selected" : ""}`}
              onClick={() => onSelectMode(m)}
            >
              <div className="mode-card-name">{MODE_LABELS[m]}</div>
              <div className="mode-card-desc">{MODE_DESCRIPTIONS[m]}</div>
              {m === "wilds" && trophy.beastsDefeated > 0 && (
                <div className="mode-card-trophy">
                  Best: {trophy.beastsDefeated} beasts · max {trophy.maxBeastValueDefeated}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mode-modifiers">
          <label className="modifier-row">
            <input
              type="checkbox"
              checked={ratchetEnabled}
              onChange={(e) => onToggleRatchet(e.target.checked)}
            />
            <span className="modifier-name">Hard Mode</span>
            <span className="modifier-desc">
              Spawn floor rises with each target cleared
            </span>
          </label>
          <label className="modifier-row">
            <input
              type="checkbox"
              checked={blindfoldEnabled}
              onChange={(e) => onToggleBlindfold(e.target.checked)}
            />
            <span className="modifier-name">Blindfold</span>
            <span className="modifier-desc">
              No spawn preview — play by pattern recognition
            </span>
          </label>
        </div>

        <button type="button" className="btn btn-primary mode-start" onClick={onStart}>
          Start
        </button>

        <button type="button" className="btn btn-ghost" onClick={onOpenScenarios}>
          Browse Scenarios
        </button>

        <button type="button" className="btn btn-ghost" onClick={onOpenRoadmap}>
          Product Roadmap
        </button>

        <p className="mode-select-footer">
          Press <kbd>`</kbd> for dev panel
        </p>
      </div>
    </div>
  );
}
