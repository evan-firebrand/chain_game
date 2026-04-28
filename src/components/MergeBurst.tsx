import { useEffect, useId, useMemo } from "react";
import { tileColors } from "./palette";

type Props = {
  cx: number;
  cy: number;
  value: number;
};

const PARTICLE_COUNT = 10;

type Particle = { dx: number; dy: number; size: number };

export function MergeBurst({ cx, cy, value }: Props) {
  const { fg } = tileColors(value);
  const id = `burst-${useId().replace(/:/g, "-")}`;

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * 2 * Math.PI;
      const dist = 35 + (i * 3.7) % 35;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 4 + (i % 5),
      };
    });
  }, []);

  useEffect(() => {
    const rules = particles.map((p, i) => `
      @keyframes ${id}-p${i} {
        0%   { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { transform: translate(${p.dx.toFixed(1)}px, ${p.dy.toFixed(1)}px) scale(0); opacity: 0; }
      }
    `);
    const style = document.createElement("style");
    style.textContent = rules.join("\n");
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [id, particles]);

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cx - p.size / 2,
            top: cy - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: fg,
            animation: `${id}-p${i} 400ms ease-out forwards`,
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      ))}
    </>
  );
}
