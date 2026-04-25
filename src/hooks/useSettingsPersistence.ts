import { useCallback, useState } from "react";
import type { GameMode, SpawnAlgo } from "../game/types";
import { DEFAULT_COLS, DEFAULT_POOL_SIZE, DEFAULT_ROWS } from "../game/types";

const SETTINGS_KEY = "2248.settings";
const DEFAULT_STRENGTH = 2.5;
const DEFAULT_SOFTNESS = 0;

export type Settings = {
  algo: SpawnAlgo;
  queueDepth: number;
  strength: number;
  softness: number;
  mode: GameMode;
  targetsEnabled: boolean;
  ratchetEnabled: boolean;
  blindfoldEnabled: boolean;
  boardRows: number;
  boardCols: number;
  poolSize: number;
};

export const DEFAULT_SETTINGS: Settings = {
  algo: "weighted",
  queueDepth: 2,
  strength: DEFAULT_STRENGTH,
  softness: DEFAULT_SOFTNESS,
  mode: "classic",
  targetsEnabled: true,
  ratchetEnabled: false,
  blindfoldEnabled: false,
  boardRows: DEFAULT_ROWS,
  boardCols: DEFAULT_COLS,
  poolSize: DEFAULT_POOL_SIZE,
};

const VALID_MODES = new Set<GameMode>(["classic", "risingFloor", "boost", "movesLimited", "wilds"]);

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && (s.algo === "weighted" || s.algo === "antiPair" || s.algo === "adversarial")) {
        return {
          algo: s.algo,
          queueDepth: typeof s.queueDepth === "number" ? s.queueDepth : 2,
          strength: typeof s.strength === "number" ? s.strength : DEFAULT_STRENGTH,
          softness: typeof s.softness === "number" ? s.softness : DEFAULT_SOFTNESS,
          mode: VALID_MODES.has(s.mode) ? s.mode : "classic",
          targetsEnabled: typeof s.targetsEnabled === "boolean" ? s.targetsEnabled : true,
          ratchetEnabled: typeof s.ratchetEnabled === "boolean" ? s.ratchetEnabled : false,
          blindfoldEnabled: typeof s.blindfoldEnabled === "boolean" ? s.blindfoldEnabled : false,
          boardRows: typeof s.boardRows === "number" ? s.boardRows : DEFAULT_ROWS,
          boardCols: typeof s.boardCols === "number" ? s.boardCols : DEFAULT_COLS,
          poolSize: typeof s.poolSize === "number" ? s.poolSize : DEFAULT_POOL_SIZE,
        };
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

type SetSettings = (updater: Settings | ((prev: Settings) => Settings)) => void;

// State + localStorage persistence combined. setSettings auto-saves on every
// update; callers don't need to remember to persist.
export function useSettingsPersistence(): [Settings, SetSettings] {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const update = useCallback<SetSettings>((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveSettings(next);
      return next;
    });
  }, []);

  return [settings, update];
}
