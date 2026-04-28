// Facade: re-exports kernel public API for consumption by ui and tuning-console.
// UI must never import from game-kernel directly.
export type {
  TileValue, Row, Col, Cell, Tile, Board,
  GameConfig, GameState, GamePhase,
  Action, CommitChainAction, NewGameAction, ActionKind,
  GameEvent, ChainResolvedEvent, TilesSpawnedEvent, RetirementFiredEvent, GameOverEvent,
} from '../game-kernel/index.js';

export {
  DEFAULT_CONFIG,
  validateChain,
  computeChainResult,
  hasLegalChainStart,
  getAdjacentCells,
  validateChainExtension,
  isPlayableTileValue,
  nextTileValue,
} from '../game-kernel/index.js';

export { GameSession } from './session.js';
export type { SessionEvent, SessionEventListener } from './events.js';
