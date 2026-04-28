import { useEffect, useState } from "react";

type Props = {
  flash: { value: number; movesAt: number } | null;
};

export function TrophyFlash({ flash }: Props) {
  const [hideAtMoves, setHideAtMoves] = useState<number | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setHideAtMoves(flash.movesAt), 1500);
    return () => clearTimeout(t);
  }, [flash]);

  if (!flash || flash.movesAt === hideAtMoves) return null;
  return (
    <div className="trophy-flash" key={`${flash.value}-${flash.movesAt}`}>
      <div className="trophy-flash-card">
        <div className="trophy-flash-label">New Trophy</div>
        <div className="trophy-flash-value">Beast {flash.value}</div>
        <div className="trophy-flash-sub">defeated</div>
      </div>
    </div>
  );
}
