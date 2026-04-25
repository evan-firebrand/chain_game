import { COLS } from "../game/types";
import { tileColors } from "./palette";

type Props = {
  queue: number[][];
  previewCount?: number;
};

export function SpawnQueue({ queue, previewCount = 2 }: Props) {
  if (previewCount <= 0) return null;
  return (
    <div className="spawn-queue" style={{ gridTemplateColumns: `repeat(${COLS}, 64px)` }}>
      {queue.map((col, c) => (
        <div key={c} className="spawn-column">
          {col.slice(0, previewCount).map((value, i) => {
            const { bg, fg } = tileColors(value);
            const opacity = Math.max(0.45, 1 - i * 0.25);
            return (
              <div
                key={i}
                className={i === 0 ? "spawn-chip spawn-chip-next" : "spawn-chip"}
                style={{
                  background: bg,
                  color: fg,
                  opacity,
                }}
              >
                {value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
