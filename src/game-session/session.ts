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
    const prevCount = this.state.events.length;
    this.state = applyAction(this.state, action);
    const newKernelEvents = this.state.events.slice(prevCount) as readonly GameEvent[];
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
