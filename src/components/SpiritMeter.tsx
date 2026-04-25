type Props = {
  spirit: number;
  cap: number;
  waveCost: number;
  frenzyActive: boolean;
  frenzyRemaining: number;
  onActivateWave: () => void;
  disabled: boolean;
};

export function SpiritMeter({
  spirit,
  cap,
  waveCost,
  frenzyActive,
  frenzyRemaining,
  onActivateWave,
  disabled,
}: Props) {
  const pct = Math.max(0, Math.min(1, spirit / cap));
  const canWave = !disabled && !frenzyActive && spirit >= waveCost;

  const segments = Array.from({ length: cap }, (_, i) => i < spirit);

  return (
    <div className={`spirit-meter${frenzyActive ? " spirit-meter-frenzy" : ""}`}>
      <div className="spirit-header">
        <span className="spirit-label">Spirit</span>
        <span className="spirit-value">
          {frenzyActive ? `Frenzy · ${frenzyRemaining}` : `${spirit} / ${cap}`}
        </span>
      </div>
      <div className="spirit-bar" aria-hidden>
        <div className="spirit-fill" style={{ width: `${pct * 100}%` }} />
        <div className="spirit-segments">
          {segments.map((on, i) => (
            <div
              key={i}
              className={`spirit-seg${on ? " spirit-seg-on" : ""}${
                i + 1 === waveCost ? " spirit-seg-mark-wave" : ""
              }${i + 1 === cap ? " spirit-seg-mark-frenzy" : ""}`}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="btn spirit-wave-btn"
        onClick={onActivateWave}
        disabled={!canWave}
        title={
          frenzyActive
            ? "Frenzy active"
            : spirit < waveCost
              ? `Need ${waveCost} spirit`
              : "Convert 3 low tiles to wilds"
        }
      >
        Spirit Wave
        <span className="spirit-wave-cost">−{waveCost}</span>
      </button>
    </div>
  );
}
