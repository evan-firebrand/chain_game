import type { Cell } from '../game-kernel/index.js';
import { pixelToCell } from './board.js';

export interface InputCallbacks {
  onChainUpdate: (chain: ReadonlyArray<Cell>) => void;
  onChainCommit: (chain: ReadonlyArray<Cell>) => void;
  onChainCancel: () => void;
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

    // Don't add if it's the same as last cell
    const last = chain[chain.length - 1];
    if (last !== undefined && last.row === cell.row && last.col === cell.col) return;

    // Check if already in chain — allow backtrack (remove from end)
    const existingIdx = chain.findIndex(c => c.row === cell.row && c.col === cell.col);
    if (existingIdx !== -1) {
      // Can only backtrack to the immediately preceding cell
      if (existingIdx === chain.length - 2) {
        chain = chain.slice(0, chain.length - 1);
        callbacks.onChainUpdate(chain);
      }
      return;
    }

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
