import type { GameState, GameConfig, GameEvent } from '../game-kernel/index.js';

export interface SessionEvent {
  readonly type: 'state-changed';
  readonly state: GameState;
  readonly config: GameConfig;
  readonly turn: number;
  readonly kernelEvents: ReadonlyArray<GameEvent>;
}

export type SessionEventListener = (event: SessionEvent) => void;
