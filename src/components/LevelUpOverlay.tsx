import { useEffect, useState } from "react";

type Props = {
  lastLevelUp: { level: number; target: number } | null;
};

// Non-blocking celebration. Shows when `lastLevelUp` changes to a non-null value
// with a different level than the last one we rendered. Auto-dismisses.
export function LevelUpOverlay({ lastLevelUp }: Props) {
  const [visible, setVisible] = useState<{ level: number; target: number } | null>(null);

  useEffect(() => {
    if (!lastLevelUp) return;
    setVisible(lastLevelUp);
    const t = setTimeout(() => setVisible(null), 1500);
    return () => clearTimeout(t);
  }, [lastLevelUp?.level, lastLevelUp?.target]);

  if (!visible) return null;
  return (
    <div className="levelup-overlay" key={`${visible.level}-${visible.target}`}>
      <div className="levelup-card">
        <div className="levelup-label">Level</div>
        <div className="levelup-level">{visible.level}</div>
        <div className="levelup-target">{visible.target} reached</div>
      </div>
    </div>
  );
}
