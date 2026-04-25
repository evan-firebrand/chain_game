import type { SpawnAlgo } from "./types";

const KEY = "2248.runs";
const MAX_ENTRIES = 200;

export type RunEntry = {
  algo: SpawnAlgo;
  seed: number;
  moves: number;
  peak: number;
  score: number;
  queueDepth: number;
  endedAt: number;
  isBot?: boolean;
};

export function readRuns(): RunEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendRun(entry: RunEntry): RunEntry[] {
  const runs = readRuns();
  runs.unshift(entry);
  const trimmed = runs.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded or unavailable — ignore
  }
  return trimmed;
}

export function clearRuns(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function summarize(runs: RunEntry[]): { algo: SpawnAlgo; count: number; medianMoves: number; avgScore: number }[] {
  const byAlgo = new Map<SpawnAlgo, RunEntry[]>();
  for (const r of runs) {
    const list = byAlgo.get(r.algo) ?? [];
    list.push(r);
    byAlgo.set(r.algo, list);
  }
  return Array.from(byAlgo.entries()).map(([algo, list]) => {
    const moves = list.map((r) => r.moves).sort((a, b) => a - b);
    const med = moves.length
      ? moves.length % 2 === 0
        ? (moves[moves.length / 2 - 1] + moves[moves.length / 2]) / 2
        : moves[(moves.length - 1) / 2]
      : 0;
    const avgScore = list.length
      ? list.reduce((a, b) => a + b.score, 0) / list.length
      : 0;
    return { algo, count: list.length, medianMoves: med, avgScore };
  });
}
