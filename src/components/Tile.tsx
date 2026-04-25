import { tileColors } from "./palette";
import { CELL_SIZE, cellOrigin } from "./boardLayout";
import { ANIM } from "./animationTiming";
import type { TileModifier } from "../game/types";

type Props = {
  value: number | null;
  row: number;
  col: number;
  selected?: boolean;
  chainIndex?: number;
  isMerging?: boolean;
  isSpawning?: boolean;
  spawnDelayMs?: number;
  transitionDelayMs?: number;
  boost?: boolean;
  expiresIn?: number;
  wild?: boolean;
  beast?: boolean;
  dangerCounter?: number;
  isDead?: boolean;
  isTrophy?: boolean;
  isFragile?: boolean;
  isStranded?: boolean;
  isIsolated?: boolean;
  modifier?: TileModifier;
};

function modifierBadge(modifier: TileModifier | undefined) {
  if (!modifier) return null;
  switch (modifier.kind) {
    case "wildcard":
      return { glyph: "✱", label: "Wildcard", count: undefined as number | undefined };
    case "lock":
      return { glyph: "🔒", label: "Lock", count: modifier.clearsRemaining };
    case "bomb":
      return { glyph: "💣", label: "Bomb", count: undefined };
    case "ice":
      return { glyph: "❄", label: "Ice", count: modifier.thawIn };
    case "anchor":
      return { glyph: "⚓", label: "Anchor", count: undefined };
    case "splitter":
      return { glyph: "÷", label: "Splitter", count: undefined };
    case "multiplier":
      return { glyph: "×", label: "Multiplier", count: modifier.factor };
  }
}

export function Tile({
  value,
  row,
  col,
  selected,
  chainIndex,
  isMerging,
  isSpawning,
  spawnDelayMs = 0,
  transitionDelayMs = 0,
  boost,
  expiresIn,
  wild,
  beast,
  dangerCounter,
  isDead,
  isTrophy,
  isFragile,
  isStranded,
  isIsolated,
  modifier,
}: Props) {
  if (value === null) return null;

  const { bg, fg } = tileColors(value);
  const label = value >= 1024 ? formatCompact(value) : String(value);
  const { x, y } = cellOrigin(row, col);

  const classes = ["tile"];
  if (selected) classes.push("tile-selected");
  if (isMerging) classes.push("tile-merging");
  if (isSpawning) classes.push("tile-spawning");
  if (boost) classes.push("tile-boost");
  if (wild) classes.push("tile-wild");
  if (beast) classes.push("tile-beast");
  if (modifier) classes.push(`tile-mod-${modifier.kind}`);
  // Precedence: trophy (peak achievement) wins over dead — even if the peak
  // value becomes unmatchable later, it's still the player's accomplishment
  // and should be celebrated, not grayed out. Fragile yields to both.
  if (isTrophy && !selected) classes.push("tile-trophy");
  if (isDead && !isTrophy && !selected) classes.push("tile-dead");
  if (isFragile && !isDead && !isTrophy && !selected) classes.push("tile-fragile");
  if (isStranded && !selected) classes.push("tile-stranded");
  if (isIsolated) classes.push("tile-isolated");

  const style: React.CSSProperties = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    color: fg,
    transform: `translate(${x}px, ${y}px)`,
    transitionDelay: transitionDelayMs ? `${transitionDelayMs}ms` : undefined,
  };
  // Wild tiles use a CSS gradient class; skip inline bg so it can show through.
  // Beast tiles use a solid CSS class for the same reason.
  if (!wild && !beast) style.background = bg;
  Object.assign(style, { "--tile-fg": fg, "--tile-bg": bg });

  if (isSpawning) {
    style.animationDelay = `${spawnDelayMs}ms`;
    style.animationDuration = `${ANIM.spawnDuration}ms`;
  }
  if (isMerging) {
    style.animationDuration = `${ANIM.popDuration}ms`;
  }

  const counterClass =
    beast && dangerCounter !== undefined && dangerCounter <= 2
      ? "tile-beast-counter tile-beast-counter-critical"
      : "tile-beast-counter";

  return (
    <div className={classes.join(" ")} style={style} data-value={value}>
      {wild && <span className="tile-wild-sparkle" aria-hidden>✦</span>}
      {boost && !wild && <span className="tile-boost-sparkle" aria-hidden>★</span>}
      {boost && expiresIn !== undefined && expiresIn <= 10 && (
        <span className="tile-boost-expiry" aria-hidden>{expiresIn}</span>
      )}
      {beast && <span className="tile-beast-fang" aria-hidden>⌇</span>}
      {beast && dangerCounter !== undefined && (
        <span className={counterClass} aria-hidden>{dangerCounter}</span>
      )}
      <span className="tile-label">{wild ? "?" : label}</span>
      {(() => {
        const badge = modifierBadge(modifier);
        if (!badge) return null;
        return (
          <span className="tile-modifier-badge" aria-label={badge.label}>
            <span className="tile-modifier-glyph" aria-hidden>{badge.glyph}</span>
            {badge.count !== undefined && (
              <span className="tile-modifier-count" aria-hidden>{badge.count}</span>
            )}
          </span>
        );
      })()}
      {chainIndex !== undefined && (
        <span className="tile-chain-index">{chainIndex + 1}</span>
      )}
    </div>
  );
}

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}
