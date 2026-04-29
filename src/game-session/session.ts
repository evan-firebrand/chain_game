import { createGame, applyAction } from '../game-kernel/index.js';
import type { GameState, GameConfig, Action, GameEvent } from '../game-kernel/index.js';
import type { SessionEvent, SessionEventListener } from './events.js';

export class GameSession {
  private state: GameState;
  private listeners: SessionEventListener[] = [];

  constructor(config: GameConfig) {
    this.state = createGame(config);
    this._emit([]);
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): void {
    const prev = this.state;
    this.state = applyAction(this.state, action);
    // Reference equality means applyAction was a no-op (game-over guard
    // or invalid chain) and `lastEvents` carries stale data from the
    // prior transition; emit nothing in that case.
    const newKernelEvents: readonly GameEvent[] =
      this.state === prev ? [] : this.state.lastEvents;
    this._emit(newKernelEvents);
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
