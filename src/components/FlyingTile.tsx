import { useEffect, useId, useMemo } from "react";
import type { Coord } from "../game/types";
import { CELL_SIZE, cellOrigin } from "./boardLayout";
import { ANIM } from "./animationTiming";
import { tileColors } from "./palette";

type Props = {
  value: number;
  from: Coord;
  waypoints: Coord[];
  delay: number;
  onArrive?: () => void;
};

export function FlyingTile({ value, waypoints, delay, onArrive }: Props) {
  const { bg, fg } = tileColors(value);
  const label = value >= 1024 ? formatCompact(value) : String(value);
  const animName = `fly-${useId().replace(/:/g, "-")}`;

  const keyframesCss = useMemo(() => {
    if (waypoints.length === 0) return "";
    const steps = waypoints.length - 1;
    const frames: string[] = [];
    for (let i = 0; i < waypoints.length; i++) {
      const pct = steps === 0 ? 0 : (i / steps) * 100;
      const { x, y } = cellOrigin(waypoints[i].r, waypoints[i].c);
      const isLast = i === waypoints.length - 1;
      const baseScale = isLast ? 0.75 : 0.9;

      // Squash-stretch based on travel direction for this segment
      let scaleX = baseScale;
      let scaleY = baseScale;
      if (!isLast && i < waypoints.length - 1) {
        const cur = waypoints[i];
        const next = waypoints[i + 1];
        const dc = Math.abs(next.c - cur.c);
        const dr = Math.abs(next.r - cur.r);
        if (dc > dr) {
          scaleX = baseScale * 1.15;
          scaleY = baseScale * 0.88;
        } else if (dr > dc) {
          scaleX = baseScale * 0.88;
          scaleY = baseScale * 1.15;
        }
      }

      frames.push(
        `${pct.toFixed(2)}% { transform: translate(${x}px, ${y}px) scaleX(${scaleX.toFixed(3)}) scaleY(${scaleY.toFixed(3)}); opacity: ${isLast ? 0 : 1}; }`
      );
    }
    return `@keyframes ${animName} { ${frames.join(" ")} }`;
  }, [waypoints, animName]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = keyframesCss;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [keyframesCss]);

  useEffect(() => {
    if (!onArrive) return;
    const totalMs = delay + ANIM.flyPerTile;
    const id = window.setTimeout(onArrive, totalMs);
    return () => window.clearTimeout(id);
  }, [delay, onArrive]);

  const start = waypoints[0];
  const startOrigin = cellOrigin(start.r, start.c);
  const animStyle = `${animName} ${ANIM.flyPerTile}ms cubic-bezier(.5,.1,.4,1) ${delay}ms forwards`;

  return (
    <>
      {/* Motion trail — same keyframe path, blurred + faded */}
      <div
        className="flying-tile flying-tile-trail"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          background: bg,
          color: fg,
          transform: `translate(${startOrigin.x}px, ${startOrigin.y}px) scaleX(0.9) scaleY(0.9)`,
          animation: animStyle,
          filter: "blur(6px)",
          opacity: 0.3,
          scale: "1.1",
        }}
        aria-hidden
      />
      {/* Main flying tile */}
      <div
        className="flying-tile tile"
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          background: bg,
          color: fg,
          transform: `translate(${startOrigin.x}px, ${startOrigin.y}px) scaleX(0.9) scaleY(0.9)`,
          animation: animStyle,
        }}
        data-value={value}
      >
        <span className="tile-label">{label}</span>
      </div>
    </>
  );
}

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}
