import type {
  Board,
  Cell,
  GameEvent,
  GameState,
  TileValue,
} from '../game-kernel/index.js';
import type { GameSession } from './session.js';

export interface PlaylogRecord {
  readonly turn: number;
  readonly timestamp: string;
  readonly boardBefore: Board;
  readonly chainPlayed: readonly Cell[];
  readonly resultValue: TileValue;
  readonly boardAfter: Board;
  readonly kernelEvents: readonly GameEvent[];
  readonly spawnPoolMinBefore: TileValue;
  readonly spawnPoolMaxBefore: TileValue;
  readonly maxTileEverBefore: TileValue;
}

export class PlaylogRecorder {
  private records: PlaylogRecord[] = [];
  private previousState: GameState;
  private unsubscribe: () => void;

  constructor(session: GameSession) {
    this.previousState = session.getState();
    this.unsubscribe = this.subscribe(session);
  }

  /**
   * Re-attach to a new session (e.g. after a Play Again rewire).
   * Records accumulated so far are preserved.
   */
  attachSession(session: GameSession): void {
    this.unsubscribe();
    this.previousState = session.getState();
    this.unsubscribe = this.subscribe(session);
  }

  getRecords(): readonly PlaylogRecord[] {
    return this.records;
  }

  serialize(): string {
    return this.records.map(r => JSON.stringify(r)).join('\n');
  }

  dispose(): void {
    this.unsubscribe();
  }

  private subscribe(session: GameSession): () => void {
    return session.on(event => {
      const chainResolved = event.kernelEvents.find(
        (e): e is Extract<GameEvent, { kind: 'chain-resolved' }> =>
          e.kind === 'chain-resolved'
      );
      if (chainResolved !== undefined) {
        const record: PlaylogRecord = {
          turn: event.turn,
          timestamp: new Date().toISOString(),
          boardBefore: this.previousState.board,
          chainPlayed: chainResolved.chain,
          resultValue: chainResolved.resultValue,
          boardAfter: event.state.board,
          kernelEvents: event.kernelEvents,
          spawnPoolMinBefore: this.previousState.spawnPoolMin,
          spawnPoolMaxBefore: this.previousState.spawnPoolMax,
          maxTileEverBefore: this.previousState.maxTileEver,
        };
        this.records.push(record);
      }
      this.previousState = event.state;
    });
  }
}
