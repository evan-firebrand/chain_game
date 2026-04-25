import { useEffect, useRef, useState } from "react";
import { effectiveChainValues, isValidAppend, mergeValue } from "../game/chain";
import { willResultBeOrphan, findIsolatedTiles } from "../game/rules";
import { healthFromPairs } from "../game/health";
import { COLS, ROWS } from "../game/types";
import type { Coord, Grid, Tile as TileData } from "../game/types";
import { Tile } from "./Tile";
import { tileColors } from "./palette";
import { FlyingTile } from "./FlyingTile";
import { MergeBurst } from "./MergeBurst";
import {
  boardHeight,
  boardWidth,
  CELL_SIZE,
  GAP,
  cellCenter,
  cellOrigin,
} from "./boardLayout";
import { ANIM } from "./animationTiming";
import type { FlyingTileSpec, Phase } from "./useCommitAnimator";

const EMPTY_DEAD_IDS = new Set<number>();

type Props = {
  grid: Grid;
  disabled: boolean;
  onCommit: (path: Coord[]) => void;
  /** When animating, overrides what's rendered. */
  displayGrid?: Grid | null;
  flyingTiles?: FlyingTileSpec[];
  landingId?: number | null;
  shakeIntensity?: number;
  spawningIds?: Set<number>;
  phase?: Phase;
  pairs?: number;
  deadIds?: Set<number>;
  trophyIds?: Set<number>;
  fragileIds?: Set<number>;
  strandedIds?: Set<number>;
};

export function Board({
  grid,
  disabled,
  onCommit,
  displayGrid,
  flyingTiles,
  landingId,
  shakeIntensity = 0,
  spawningIds,
  phase = "idle",
  pairs,
  deadIds,
  trophyIds,
  fragileIds,
  strandedIds,
}: Props) {
  const [path, setPath] = useState<Coord[]>([]);
  const pathRef = useRef<Coord[]>([]);
  const draggingRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const renderGrid = displayGrid ?? grid;

  // Find landing tile position for particle burst during pop phase
  const burstTarget = (phase === "pop" && landingId != null)
    ? (() => {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const t = renderGrid[r][c];
            if (t !== null && t.id === landingId) return { r, c, value: t.value };
          }
        }
        return null;
      })()
    : null;

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const pointToCell = (clientX: number, clientY: number): Coord | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const step = CELL_SIZE + GAP;
    const c = Math.floor((x - GAP / 2) / step);
    const r = Math.floor((y - GAP / 2) / step);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    const cellLeft = GAP + c * step;
    const cellTop = GAP + r * step;
    if (x < cellLeft - GAP / 2 || x > cellLeft + CELL_SIZE + GAP / 2) return null;
    if (y < cellTop - GAP / 2 || y > cellTop + CELL_SIZE + GAP / 2) return null;
    return { r, c };
  };

  const tryExtend = (target: Coord) => {
    let nextPath = pathRef.current;
    if (nextPath.length === 0) return;

    while (true) {
      const tip = nextPath[nextPath.length - 1];
      if (tip.r === target.r && tip.c === target.c) break;

      const step: Coord = {
        r: tip.r + Math.sign(target.r - tip.r),
        c: tip.c + Math.sign(target.c - tip.c),
      };

      const existingIdx = nextPath.findIndex((p) => p.r === step.r && p.c === step.c);
      if (existingIdx !== -1) {
        if (existingIdx === nextPath.length - 2) {
          nextPath = nextPath.slice(0, -1);
          continue;
        }
        break;
      }

      const t = grid[step.r][step.c];
      if (t === null) break;

      const pathTiles = nextPath.map(({ r, c }) => grid[r][c] as TileData);
      if (!isValidAppend(pathTiles, t)) break;

      nextPath = [...nextPath, step];
    }

    if (nextPath !== pathRef.current) {
      pathRef.current = nextPath;
      setPath(nextPath);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    if (grid[cell.r][cell.c] === null) return;
    e.preventDefault();
    boardRef.current?.setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    const next = [cell];
    pathRef.current = next;
    setPath(next);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    tryExtend(cell);
  };

  const endDrag = (commit: boolean) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const committed = pathRef.current;
    pathRef.current = [];
    setPath([]);
    if (commit && committed.length >= 2) onCommit(committed);
  };

  const handlePointerUp = () => endDrag(true);
  const handlePointerCancel = () => endDrag(false);

  // Clear any active drag state when we become disabled mid-drag.
  useEffect(() => {
    if (disabled && draggingRef.current) {
      draggingRef.current = false;
      pathRef.current = [];
      setPath([]);
    }
  }, [disabled]);

  const chainTiles = path.map(({ r, c }) => grid[r][c] as TileData);
  const chainValues = effectiveChainValues(chainTiles);
  const mergePreview = path.length >= 2 ? mergeValue(chainValues) : null;
  const landingColor =
    mergePreview !== null ? tileColors(mergePreview).bg : "#999";
  const resultOrphan =
    mergePreview !== null ? willResultBeOrphan(grid, path, mergePreview) : false;
  // Boost mode drag feedback: how many boosts are in the selected path, and
  // whether the chain length meets the gate (≥5 to activate).
  const boostCountInPath = path.reduce((n, { r, c }) => {
    const t = grid[r][c];
    return n + (t?.boost ? 1 : 0);
  }, 0);
  const boostGateActive = path.length >= 3;
  // Wilds mode drag feedback: beasts need a chain of 3+ to defeat.
  const beastInPath = path.some(({ r, c }) => grid[r][c]?.beast);
  const beastGateActive = path.length >= 3;

  const deadSet = deadIds ?? EMPTY_DEAD_IDS;
  const trophySet = trophyIds ?? EMPTY_DEAD_IDS;
  const fragileSet = fragileIds ?? EMPTY_DEAD_IDS;
  const strandedSet = strandedIds ?? EMPTY_DEAD_IDS;
  const isolatedSet = path.length === 0 ? findIsolatedTiles(grid) : EMPTY_DEAD_IDS;

  const indexOfCell = (r: number, c: number) =>
    path.findIndex((p) => p.r === r && p.c === c);

  // Flatten tiles with positions so React can key by id (smooth movement).
  const tilesWithPos: Array<{
    id: number;
    value: number;
    r: number;
    c: number;
    boost?: boolean;
    expiresIn?: number;
    wild?: boolean;
    beast?: boolean;
    dangerCounter?: number;
    modifier?: import("../game/types").TileModifier;
  }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = renderGrid[r][c];
      if (t !== null) {
        tilesWithPos.push({
          id: t.id,
          value: t.value,
          r,
          c,
          boost: t.boost,
          expiresIn: t.expiresIn,
          wild: t.wild,
          beast: t.beast,
          dangerCounter: t.dangerCounter,
          modifier: t.modifier,
        });
      }
    }
  }

  const shakeStyle =
    shakeIntensity > 0
      ? {
          animation: `board-shake ${ANIM.shakeDuration}ms cubic-bezier(.36,.07,.19,.97)`,
          ["--shake-x" as string]: `${shakeIntensity}px`,
          ["--shake-y" as string]: `${Math.round(shakeIntensity * 0.25)}px`,
        }
      : undefined;

  // Board tint tracks the pairs-based health state. Skip the tint during
  // animations so the mid-merge grid doesn't briefly re-color.
  const boardClasses = ["board"];
  if (phase === "idle" && pairs !== undefined && pairs > 0) {
    boardClasses.push(`board-health-${healthFromPairs(pairs)}`);
  }

  return (
    <div
      ref={boardRef}
      className={boardClasses.join(" ")}
      style={{
        width: boardWidth(),
        height: boardHeight(),
        touchAction: "none",
        ...shakeStyle,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Static cell backgrounds. */}
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((_, c) => {
          const o = cellOrigin(r, c);
          return (
            <div
              key={`bg-${r}-${c}`}
              className="cell-bg"
              style={{
                left: o.x,
                top: o.y,
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            />
          );
        })
      )}

      {/* Tiles — absolutely positioned, keyed by id for smooth re-layout. */}
      {tilesWithPos.map(({ id, value, r, c, boost, expiresIn, wild, beast, dangerCounter, modifier }) => {
        const idx = indexOfCell(r, c);
        const selected = idx !== -1;
        const isLanding = id === landingId;
        const isSpawning = spawningIds?.has(id) ?? false;
        const colStaggerMs =
          phase === "dropping" ? c * ANIM.dropColStagger : 0;
        return (
          <Tile
            key={id}
            value={value}
            row={r}
            col={c}
            selected={selected}
            chainIndex={selected ? idx : undefined}
            isMerging={isLanding && phase === "pop"}
            isSpawning={isSpawning && phase === "spawning"}
            spawnDelayMs={isSpawning ? c * ANIM.spawnColStagger : 0}
            transitionDelayMs={colStaggerMs}
            boost={boost}
            expiresIn={expiresIn}
            wild={wild}
            beast={beast}
            dangerCounter={dangerCounter}
            isDead={deadSet.has(id)}
            isTrophy={trophySet.has(id)}
            isFragile={fragileSet.has(id)}
            isStranded={strandedSet.has(id)}
            isIsolated={!selected && !deadSet.has(id) && !trophySet.has(id) && isolatedSet.has(id)}
            modifier={modifier}
          />
        );
      })}

      {/* Flying tiles during chain commit. */}
      {flyingTiles?.map((f) => (
        <FlyingTile
          key={f.key}
          value={f.value}
          from={f.from}
          waypoints={f.waypoints}
          delay={f.delay}
        />
      ))}

      {/* Particle burst on merge pop. key=landingId forces remount per unique merge. */}
      {burstTarget && (
        <MergeBurst
          key={landingId}
          cx={cellCenter(burstTarget.r, burstTarget.c).x}
          cy={cellCenter(burstTarget.r, burstTarget.c).y}
          value={burstTarget.value}
        />
      )}

      {/* Drag-preview overlay (multi-layer chain line + landing ring). */}
      {path.length > 0 && (
        <svg
          className="chain-overlay"
          width={boardWidth()}
          height={boardHeight()}
        >
          <defs>
            <linearGradient
              id="chain-gradient"
              gradientUnits="userSpaceOnUse"
              x1={cellCenter(path[0].r, path[0].c).x}
              y1={cellCenter(path[0].r, path[0].c).y}
              x2={cellCenter(path[path.length - 1].r, path[path.length - 1].c).x}
              y2={cellCenter(path[path.length - 1].r, path[path.length - 1].c).y}
            >
              <stop offset="0%" stopColor={tileColors(chainValues[0] ?? 2).fg} />
              <stop offset="100%" stopColor={landingColor} />
            </linearGradient>
            <filter id="chain-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
            </filter>
          </defs>

          {/* Glow layer — thick blurred polyline */}
          <polyline
            points={path.map(({ r, c }) => { const { x, y } = cellCenter(r, c); return `${x},${y}`; }).join(" ")}
            stroke={landingColor}
            strokeWidth={20}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            opacity={0.15}
            filter="url(#chain-glow)"
          />

          {/* Gradient main line */}
          <polyline
            points={path.map(({ r, c }) => { const { x, y } = cellCenter(r, c); return `${x},${y}`; }).join(" ")}
            stroke="url(#chain-gradient)"
            strokeWidth={8}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            opacity={0.85}
          />

          {/* Animated energy flow — dashes traveling toward landing */}
          <polyline
            className="chain-flow-line"
            points={path.map(({ r, c }) => { const { x, y } = cellCenter(r, c); return `${x},${y}`; }).join(" ")}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="12 8"
          />

          {/* Node circles at each tile center (exclude landing tip) */}
          {path.slice(0, -1).map(({ r, c }, i) => {
            const { x, y } = cellCenter(r, c);
            return (
              <circle
                key={`node-${r}-${c}`}
                cx={x}
                cy={y}
                r={8}
                fill={tileColors(chainValues[i] ?? 2).fg}
                opacity={0.85}
              />
            );
          })}

          {/* Landing tip ring + merge preview */}
          {mergePreview !== null && (
            <g>
              <circle
                cx={cellCenter(path[path.length - 1].r, path[path.length - 1].c).x}
                cy={cellCenter(path[path.length - 1].r, path[path.length - 1].c).y}
                r={CELL_SIZE / 2 - 2}
                fill="none"
                stroke={resultOrphan ? "#f87171" : landingColor}
                strokeWidth={3}
                strokeDasharray={resultOrphan ? "6 4" : undefined}
              />
              <text
                x={cellCenter(path[path.length - 1].r, path[path.length - 1].c).x}
                y={cellCenter(path[path.length - 1].r, path[path.length - 1].c).y - CELL_SIZE / 2 - 2}
                textAnchor="middle"
                fontSize={14}
                fontWeight={700}
                fill={resultOrphan ? "#f87171" : landingColor}
              >
                {resultOrphan ? `⚠ ${mergePreview} orphan` : `→ ${mergePreview}`}
              </text>
              {boostCountInPath > 0 && (
                <text
                  x={cellCenter(path[path.length - 1].r, path[path.length - 1].c).x}
                  y={cellCenter(path[path.length - 1].r, path[path.length - 1].c).y - CELL_SIZE / 2 - 20}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill={boostGateActive ? "#ffd55a" : "#8a8a8a"}
                >
                  {boostGateActive
                    ? `BOOST ×${Math.min(4, 2 ** boostCountInPath)} ACTIVE`
                    : `BOOST ×${Math.min(4, 2 ** boostCountInPath)} · need chain ${3 - path.length} more`}
                </text>
              )}
              {beastInPath && (
                <text
                  x={cellCenter(path[path.length - 1].r, path[path.length - 1].c).x}
                  y={cellCenter(path[path.length - 1].r, path[path.length - 1].c).y - CELL_SIZE / 2 - 20}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={800}
                  fill={beastGateActive ? "#ff7a85" : "#8a3a40"}
                >
                  {beastGateActive
                    ? "BEAST DEFEAT"
                    : `BEAST · need chain ${3 - path.length} more`}
                </text>
              )}
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
