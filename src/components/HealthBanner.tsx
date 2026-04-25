import { useEffect, useRef, useState } from "react";
import type { HealthState } from "../game/health";
import { healthTransitionMessage } from "../game/health";

type Props = {
  currentHealth: HealthState;
};

type BannerState = {
  message: string;
  tone: HealthState;
  key: number;
};

// Non-blocking banner that fires on health-state transitions. Watches
// `currentHealth`, fires a message whenever it changes, auto-dismisses after
// ~1.2s. Keyed so rapid re-transitions retrigger the animation cleanly.
export function HealthBanner({ currentHealth }: Props) {
  const prevRef = useRef<HealthState | null>(null);
  const [visible, setVisible] = useState<BannerState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = currentHealth;
    if (prev === null || prev === currentHealth) return;
    const message = healthTransitionMessage(prev, currentHealth);
    if (!message) return;
    const key = Date.now();
    setVisible({ message, tone: currentHealth, key });
    const t = setTimeout(() => {
      setVisible((cur) => (cur?.key === key ? null : cur));
    }, 1200);
    return () => clearTimeout(t);
  }, [currentHealth]);

  if (!visible) return null;
  return (
    <div className={`health-banner health-banner-${visible.tone}`} key={visible.key}>
      {visible.message}
    </div>
  );
}
