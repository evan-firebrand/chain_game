import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { newGame, planCommit, resolveFloor, undoLast } from "../game/engine";
import { buildTelemetry } from "../game/telemetry";
import { getMode } from "../game/modes";
import { applySpiritWave } from "../game/modes/wilds";
import { stampRandomModifiers } from "../game/modifiers/sandbox";
import { classifyTiles, type TileClassification } from "../game/tileClassification";
import { useCommitAnimator } from "../components/useCommitAnimator";
import { appendRun, readRuns } from "../game/runLog";
import type { RunEntry } from "../game/runLog";
import { recordRun as recordTrophyRun } from "../game/trophyWall";
import type { Coord, GameMode, GameState, SpawnAlgo, Telemetry } from "../game/types";
import { configureBoard } from "../game/types";
import type { Settings } from "./useSettingsPersistence";
import { DEFAULT_SETTINGS, loadSettings } from "./useSettingsPersistence";

export type View = "modeSelect" | "game" | "scenarios" | "roadmap";

type SetSettings = (updater: Settings | ((prev: Settings) => Settings)) => void;

export type GameControllerActions = {
  commit: (path: Coord[]) => void;
  undo: () => void;
  restart: () => void;
  newRunWithSeed: (seed: number) => void;
  startFromMenu: () => void;
  backToMenu: () => void;
  openScenarios: () => void;
  openRoadmap: () => void;
  loadScenario: (state: GameState) => void;
  resetDefaults: () => void;
  changeAlgo: (a: SpawnAlgo) => void;
  changeStrength: (n: number) => void;
  changeSoftness: (n: number) => void;
  changeMode: (m: GameMode) => void;
  changeTargetsEnabled: (b: boolean) => void;
  changeRatchetEnabled: (b: boolean) => void;
  changeBlindfold: (b: boolean) => void;
  changeQueueDepth: (n: number) => void;
  changeBoardSize: (rows: number, cols: number) => void;
  changePoolSize: (n: number) => void;
  runsChanged: () => void;
  activateSpiritWave: () => void;
  stampModifiers: (ratio?: number) => void;
};

export type GameController = {
  state: GameState;
  view: View;
  animator: ReturnType<typeof useCommitAnimator>;
  runs: RunEntry[];
  telemetry: Telemetry;
  tileClass: TileClassification;
  isAnimating: boolean;
  actions: GameControllerActions;
};

export function useGameController(settings: Settings, setSettings: SetSettings): GameController {
  const [view, setView] = useState<View>("modeSelect");
  const [state, setState] = useState<GameState>(() => {
    const s = loadSettings();
    configureBoard({ rows: s.boardRows, cols: s.boardCols, poolSize: s.poolSize });
    return newGame(undefined, s.algo, s.strength, s.softness, s.mode, s.targetsEnabled, s.ratchetEnabled);
  });
  const [runs, setRuns] = useState<RunEntry[]>(() => readRuns());
  const loggedGameOverRef = useRef<number | null>(null);
  const animator = useCommitAnimator();

  // Game-over logging: fires once per finished game (keyed by startedAt).
  useEffect(() => {
    if (!state.gameOver) return;
    if (state.moves === 0) return;
    const key = state.startedAt;
    if (loggedGameOverRef.current === key) return;
    loggedGameOverRef.current = key;
    const updated = appendRun({
      algo: state.algo,
      seed: state.seed,
      moves: state.moves,
      peak: state.peak,
      score: state.score,
      queueDepth: settings.queueDepth,
      endedAt: Date.now(),
    });
    setRuns(updated);
    if (state.mode === "wilds") {
      recordTrophyRun(state);
    }
  }, [state, settings.queueDepth]);

  const commit = useCallback(
    (path: Coord[]) => {
      const plan = planCommit(state, path);
      if (!plan) return;
      animator.play(plan, () => setState(plan.finalState));
    },
    [state, animator]
  );

  const undo = useCallback(() => {
    setState((s) => undoLast(s));
  }, []);

  const startFreshGame = useCallback(
    (overrides?: Partial<Settings> & { seed?: number }) => {
      const merged = { ...settings, ...(overrides ?? {}) };
      loggedGameOverRef.current = null;
      configureBoard({ rows: merged.boardRows, cols: merged.boardCols, poolSize: merged.poolSize });
      setState(
        newGame(
          overrides?.seed,
          merged.algo,
          merged.strength,
          merged.softness,
          merged.mode,
          merged.targetsEnabled,
          merged.ratchetEnabled
        )
      );
    },
    [settings]
  );

  const restart = useCallback(() => startFreshGame(), [startFreshGame]);
  const newRunWithSeed = useCallback((seed: number) => startFreshGame({ seed }), [startFreshGame]);

  const changeAlgo = useCallback(
    (algo: SpawnAlgo) => {
      setSettings((s) => ({ ...s, algo }));
      startFreshGame({ algo });
    },
    [setSettings, startFreshGame]
  );

  const changeStrength = useCallback(
    (strength: number) => {
      setSettings((s) => ({ ...s, strength }));
      startFreshGame({ strength });
    },
    [setSettings, startFreshGame]
  );

  const changeSoftness = useCallback(
    (softness: number) => {
      setSettings((s) => ({ ...s, softness }));
      startFreshGame({ softness });
    },
    [setSettings, startFreshGame]
  );

  const changeMode = useCallback(
    (mode: GameMode) => {
      setSettings((s) => ({ ...s, mode }));
      startFreshGame({ mode });
    },
    [setSettings, startFreshGame]
  );

  const changeTargetsEnabled = useCallback(
    (targetsEnabled: boolean) => {
      setSettings((s) => ({ ...s, targetsEnabled }));
      startFreshGame({ targetsEnabled });
    },
    [setSettings, startFreshGame]
  );

  const changeRatchetEnabled = useCallback(
    (ratchetEnabled: boolean) => {
      setSettings((s) => ({ ...s, ratchetEnabled }));
      startFreshGame({ ratchetEnabled });
    },
    [setSettings, startFreshGame]
  );

  const changeBlindfold = useCallback(
    (blindfoldEnabled: boolean) => setSettings((s) => ({ ...s, blindfoldEnabled })),
    [setSettings]
  );

  const changeQueueDepth = useCallback(
    (queueDepth: number) => setSettings((s) => ({ ...s, queueDepth })),
    [setSettings]
  );

  const changeBoardSize = useCallback(
    (boardRows: number, boardCols: number) => {
      setSettings((s) => ({ ...s, boardRows, boardCols }));
      startFreshGame({ boardRows, boardCols });
    },
    [setSettings, startFreshGame]
  );

  const changePoolSize = useCallback(
    (poolSize: number) => {
      setSettings((s) => ({ ...s, poolSize }));
      startFreshGame({ poolSize });
    },
    [setSettings, startFreshGame]
  );

  const resetDefaults = useCallback(() => {
    const fresh = { ...DEFAULT_SETTINGS };
    setSettings(fresh);
    loggedGameOverRef.current = null;
    configureBoard({ rows: fresh.boardRows, cols: fresh.boardCols, poolSize: fresh.poolSize });
    setState(newGame(undefined, fresh.algo, fresh.strength, fresh.softness, fresh.mode, fresh.targetsEnabled, fresh.ratchetEnabled));
  }, [setSettings]);

  const startFromMenu = useCallback(() => {
    startFreshGame();
    setView("game");
  }, [startFreshGame]);

  const backToMenu = useCallback(() => setView("modeSelect"), []);
  const openScenarios = useCallback(() => setView("scenarios"), []);
  const openRoadmap = useCallback(() => setView("roadmap"), []);

  const loadScenario = useCallback((scenarioState: GameState) => {
    loggedGameOverRef.current = null;
    setState(scenarioState);
    setView("game");
  }, []);

  const runsChanged = useCallback(() => setRuns(readRuns()), []);

  const activateSpiritWave = useCallback(() => {
    setState((s) => applySpiritWave(s));
  }, []);

  const stampModifiers = useCallback((ratio = 0.4) => {
    setState((s) => ({ ...s, grid: stampRandomModifiers(s.grid, ratio) }));
  }, []);

  const isAnimating = animator.phase !== "idle";
  const telemetry = useMemo(() => buildTelemetry(state), [state]);
  const modeBehavior = useMemo(() => getMode(state.mode), [state.mode]);
  const tileClass = useMemo(
    () => classifyTiles(state, { floor: resolveFloor(state, modeBehavior), isAnimating }),
    [state, modeBehavior, isAnimating]
  );

  return {
    state,
    view,
    animator,
    runs,
    telemetry,
    tileClass,
    isAnimating,
    actions: {
      commit,
      undo,
      restart,
      newRunWithSeed,
      startFromMenu,
      backToMenu,
      openScenarios,
      openRoadmap,
      loadScenario,
      resetDefaults,
      changeAlgo,
      changeStrength,
      changeSoftness,
      changeMode,
      changeTargetsEnabled,
      changeRatchetEnabled,
      changeBlindfold,
      changeQueueDepth,
      changeBoardSize,
      changePoolSize,
      runsChanged,
      activateSpiritWave,
      stampModifiers,
    },
  };
}
