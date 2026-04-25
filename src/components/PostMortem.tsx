type Props = {
  recentStartCounts: number[];
  moves: number;
};

// Post-mortem on game over. Shows the trajectory of chain-starts over recent moves
// as a mini sparkline, plus a short narrative locating the peak relative to the end.
export function PostMortem({ recentStartCounts, moves }: Props) {
  if (recentStartCounts.length === 0) return null;

  const peak = Math.max(...recentStartCounts);
  if (peak === 0) return null;

  const lastIdx = recentStartCounts.length - 1;
  const peakIdx = recentStartCounts.indexOf(peak);
  const movesAgo = lastIdx - peakIdx;
  const windowSize = recentStartCounts.length;
  const windowStartMove = Math.max(0, moves - windowSize + 1);

  const W = 180;
  const H = 38;
  const stepX = W / Math.max(1, windowSize - 1);
  const points = recentStartCounts
    .map((v, i) => `${(i * stepX).toFixed(1)},${(H - (v / peak) * H).toFixed(1)}`)
    .join(" ");

  const peakX = peakIdx * stepX;
  const peakY = H - (peak / peak) * H;

  return (
    <div className="postmortem">
      <div className="postmortem-title">Pair trajectory (last {windowSize} moves)</div>
      <svg className="postmortem-spark" width={W} height={H} aria-hidden>
        <polyline
          points={points}
          fill="none"
          stroke="#a9b1c0"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={peakX} cy={peakY} r={3} fill="#f5a524" />
      </svg>
      <div className="postmortem-narrative">
        Peaked at <strong>{peak}</strong> pairs {movesAgo === 0 ? "on your last move" : `${movesAgo} ${movesAgo === 1 ? "move" : "moves"} ago`}
        {windowStartMove > 0 ? ` (move ${peakIdx + windowStartMove})` : ""}. Ended at <strong>0</strong>.
      </div>
    </div>
  );
}
