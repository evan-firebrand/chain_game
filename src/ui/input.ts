import type { Cell } from '../game-session/index.js';
import { pixelToCell } from './board.js';

export interface InputCallbacks {
  onChainUpdate: (chain: readonly Cell[]) => void;
  onChainCommit: (chain: readonly Cell[]) => void;
  onChainCancel: () => void;
  /** Return true if appending `cell` to `chain` would be a legal move. */
  canExtend: (chain: readonly Cell[], cell: Cell) => boolean;
}

function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.row - b.row) <= 1 &&
    Math.abs(a.col - b.col) <= 1 &&
    (a.row !== b.row || a.col !== b.col);
}

export function attachInput(
  canvas: HTMLCanvasElement,
  rows: number,
  cols: number,
  callbacks: InputCallbacks,
): () => void {
  let active = false;
  let chain: Cell[] = [];

  function getCell(e: PointerEvent): Cell | null {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return pixelToCell(x, y, rows, cols);
  }

  function onDown(e: PointerEvent): void {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    active = true;
    chain = [];
    const cell = getCell(e);
    if (cell !== null) {
      chain = [cell];
      callbacks.onChainUpdate(chain);
    }
  }

  function onMove(e: PointerEvent): void {
    if (!active) return;
    e.preventDefault();
    const cell = getCell(e);
    if (cell === null) return;

    const last = chain[chain.length - 1];
    if (last !== undefined && last.row === cell.row && last.col === cell.col) return;

    // Backtrack: if cell is already in chain, slice back to it (any depth)
    const existingIdx = chain.findIndex(c => c.row === cell.row && c.col === cell.col);
    if (existingIdx !== -1) {
      chain = chain.slice(0, existingIdx + 1);
      callbacks.onChainUpdate(chain);
      return;
    }

    // Only extend if adjacent AND the game rules allow it
    if (last !== undefined && !isAdjacent(last, cell)) return;
    if (!callbacks.canExtend(chain, cell)) return;

    chain = [...chain, cell];
    callbacks.onChainUpdate(chain);
  }

  function onUp(e: PointerEvent): void {
    if (!active) return;
    e.preventDefault();
    active = false;

    if (chain.length >= 2) {
      callbacks.onChainCommit(chain);
    } else {
      callbacks.onChainCancel();
    }
    chain = [];
  }

  function onCancel(): void {
    active = false;
    chain = [];
    callbacks.onChainCancel();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
  };
}
