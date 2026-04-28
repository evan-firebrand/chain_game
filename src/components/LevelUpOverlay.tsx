import { useEffect, useState } from "react";

type Props = {
  lastLevelUp: { level: number; target: number } | null;
};

// Non-blocking celebration. Shows when `lastLevelUp` changes to a non-null value
// with a different level than the last one we rendered. Auto-dismisses.
export function LevelUpOverlay({ lastLevelUp }: Props) {
  const [hideAtLevel, setHideAtLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!lastLevelUp) return;
    const t = setTimeout(() => setHideAtLevel(lastLevelUp.level), 1500);
    return () => clearTimeout(t);
  }, [lastLevelUp]);

  if (!lastLevelUp || lastLevelUp.level === hideAtLevel) return null;
  return (
    <div className="levelup-overlay" key={`${lastLevelUp.level}-${lastLevelUp.target}`}>
      <div className="levelup-card">
        <div className="levelup-label">Level</div>
        <div className="levelup-level">{lastLevelUp.level}</div>
        <div className="levelup-target">{lastLevelUp.target} reached</div>
      </div>
    </div>
  );
}
