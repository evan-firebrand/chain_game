import { useCallback, useEffect, useRef, useState } from "react";
import type { CommitPlan } from "../game/engine";
import type { Coord, Grid } from "../game/types";
import { ANIM, PHASE } from "./animationTiming";

type NonNullPlan = Exclude<CommitPlan, null>;

export type Phase = "idle" | "flying" | "pop" | "dropping" | "spawning";

export type FlyingTileSpec = {
  key: string;
  value: number;
  from: Coord;
  waypoints: Coord[];
  delay: number;
};

export type AnimatorState = {
  phase: Phase;
  displayGrid: Grid | null;
  flyingTiles: FlyingTileSpec[];
  landingId: number | null;
  shakeIntensity: number;
  spawningIds: Set<number>;
};

const INITIAL: AnimatorState = {
  phase: "idle",
  displayGrid: null,
  flyingTiles: [],
  landingId: null,
  shakeIntensity: 0,
  spawningIds: new Set(),
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCommitAnimator() {
  const [state, setState] = useState<AnimatorState>(INITIAL);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const play = useCallback((plan: NonNullPlan, onDone: () => void) => {
    clearTimers();

    const reduced = prefersReducedMotion();
    const scale = reduced ? 0.08 : 1;

    // Per-tile flyers: each non-landing chain tile travels along the remaining
    // chain path into the landing cell.
    const landing = plan.landing;
    const flyers: FlyingTileSpec[] = [];
    for (let i = 0; i < plan.path.length - 1; i++) {
      const waypoints = plan.path.slice(i);
      const last = waypoints[waypoints.length - 1];
      if (last.r !== landing.r || last.c !== landing.c) waypoints.push(landing);
      flyers.push({
        key: `${plan.chainIds[i]}`,
        value: plan.chainValues[i],
        from: plan.path[i],
        waypoints,
        delay: i * ANIM.flyStagger,
      });
    }

    setState({
      phase: "flying",
      displayGrid: plan.duringFlight,
      flyingTiles: flyers,
      landingId: null,
      shakeIntensity: 0,
      spawningIds: new Set(),
    });

    // → pop
    timers.current.push(
      window.setTimeout(() => {
        const intensity =
          plan.resultValue >= ANIM.shakeThreshold
            ? Math.min(6, 3 + Math.log2(plan.resultValue / ANIM.shakeThreshold))
            : 0;
        setState((s) => ({
          ...s,
          phase: "pop",
          displayGrid: plan.afterMerge,
          flyingTiles: [],
          landingId: plan.resultId,
          shakeIntensity: intensity,
        }));
        if (intensity > 0) {
          timers.current.push(
            window.setTimeout(
              () => setState((s) => ({ ...s, shakeIntensity: 0 })),
              ANIM.shakeDuration * scale
            )
          );
        }
      }, PHASE.pop * scale)
    );

    // → dropping
    timers.current.push(
      window.setTimeout(() => {
        setState((s) => ({
          ...s,
          phase: "dropping",
          displayGrid: plan.afterGravity,
        }));
      }, PHASE.dropping * scale)
    );

    // → spawning
    timers.current.push(
      window.setTimeout(() => {
        const spawningIds = new Set(plan.spawns.map((sp) => sp.id));
        setState((s) => ({
          ...s,
          phase: "spawning",
          displayGrid: plan.afterRefill,
          spawningIds,
        }));
      }, PHASE.spawning * scale)
    );

    // → idle + canonical commit
    timers.current.push(
      window.setTimeout(() => {
        setState(INITIAL);
        onDone();
      }, PHASE.idle * scale)
    );
  }, []);

  return { ...state, play };
}
