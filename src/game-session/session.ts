import { createGame, applyAction } from '../game-kernel/index.js';
import type { GameState, GameConfig, Action, GameEvent } from '../game-kernel/index.js';
import type { SessionEvent, SessionEventListener } from './events.js';

export class GameSession {
  private state: GameState;
  private listeners: SessionEventListener[] = [];

  // Tier 2 keys reject mid-game patches. See docs/engineering/PARAMETER_TIERS.md
  // and docs/engineering/adr/0002-session-update-config.md.
  private static readonly TIER2_KEYS: readonly (keyof GameConfig)[] = [
    'gridRows',
    'gridCols',
    'spawnPoolMin',
    'spawnPoolMax',
    'prngSeed',
  ];

  constructor(config: GameConfig) {
    this.state = createGame(config);
    this._emit([]);
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): void {
    const prevCount = this.state.events.length;
    this.state = applyAction(this.state, action);
    const newKernelEvents = this.state.events.slice(prevCount) as readonly GameEvent[];
    this._emit(newKernelEvents);
  }

  updateConfig(patch: Partial<GameConfig>): void {
    for (const key of Object.keys(patch)) {
      if (GameSession.TIER2_KEYS.includes(key as keyof GameConfig)) {
        throw new Error(
          `Config key "${key}" is Tier 2; dispatch a 'new-game' action instead`
        );
      }
    }
    const newConfig: GameConfig = { ...this.state.config, ...patch };
    this.state = { ...this.state, config: newConfig };
    this._emit([]);
  }

  on(listener: SessionEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private _emit(kernelEvents: readonly GameEvent[]): void {
    const event: SessionEvent = {
      type: 'state-changed',
      state: this.state,
      config: this.state.config,
      turn: this.state.turn,
      kernelEvents,
    };
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
