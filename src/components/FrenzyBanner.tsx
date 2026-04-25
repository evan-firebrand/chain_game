type Props = {
  remaining: number;
};

export function FrenzyBanner({ remaining }: Props) {
  if (remaining <= 0) return null;
  return (
    <div className="frenzy-banner" role="status">
      <span className="frenzy-banner-icon" aria-hidden>✦</span>
      <span className="frenzy-banner-text">WILD FRENZY</span>
      <span className="frenzy-banner-count">{remaining} spawns · 1.5× chains</span>
    </div>
  );
}
