import { useEffect, useState } from "react";

type Props = {
  flash: { value: number; movesAt: number } | null;
};

export function TrophyFlash({ flash }: Props) {
  const [visible, setVisible] = useState<{ value: number; movesAt: number } | null>(null);

  useEffect(() => {
    if (!flash) return;
    setVisible(flash);
    const t = setTimeout(() => setVisible(null), 1500);
    return () => clearTimeout(t);
  }, [flash?.value, flash?.movesAt]);

  if (!visible) return null;
  return (
    <div className="trophy-flash" key={`${visible.value}-${visible.movesAt}`}>
      <div className="trophy-flash-card">
        <div className="trophy-flash-label">New Trophy</div>
        <div className="trophy-flash-value">Beast {visible.value}</div>
        <div className="trophy-flash-sub">defeated</div>
      </div>
    </div>
  );
}
