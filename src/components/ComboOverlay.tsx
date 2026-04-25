import { useEffect, useRef, useState } from "react";
import type { LastMerge } from "../game/types";

type Props = { lastMerge: LastMerge | null };

// Flashes a "COMBO!" banner when a long chain (5+) commits. Non-blocking, auto-dismisses.
// Keyed off the lastMerge identity so repeat combos retrigger the animation.
export function ComboOverlay({ lastMerge }: Props) {
  const [visible, setVisible] = useState<{ bonus: number; token: number } | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!lastMerge?.combo) return;
    tokenRef.current += 1;
    const token = tokenRef.current;
    setVisible({ bonus: lastMerge.comboBonus ?? 0, token });
    const t = setTimeout(() => {
      setVisible((cur) => (cur?.token === token ? null : cur));
    }, 900);
    return () => clearTimeout(t);
  }, [lastMerge]);

  if (!visible) return null;
  return (
    <>
      <div className="combo-vignette" key={`vignette-${visible.token}`} />
      <div className="combo-flash" key={visible.token}>
        <div className="combo-flash-label">COMBO!</div>
        {visible.bonus > 0 && <div className="combo-flash-bonus">+{visible.bonus}</div>}
      </div>
    </>
  );
}
