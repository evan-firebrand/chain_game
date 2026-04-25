// Board-health state — a three-tier classification based on the number of
// valid chain-starts remaining. GREEN is "plenty of room to play", YELLOW is
// "manage carefully", RED is "run-ending decisions right now."
// Thresholds: green ≥16, yellow 6-15, red ≤5.
export type HealthState = "green" | "yellow" | "red";

export function healthFromPairs(pairs: number): HealthState {
  if (pairs <= 5) return "red";
  if (pairs <= 15) return "yellow";
  return "green";
}

// Short message shown when the state transitions. Null for same-state, or for
// transitions we don't want to narrate (e.g., green→red skipping yellow briefly).
export function healthTransitionMessage(
  from: HealthState,
  to: HealthState
): string | null {
  if (from === to) return null;
  // Escalations
  if (from === "green" && to === "yellow") return "Heating up";
  if (from === "yellow" && to === "red") return "Red alert";
  if (from === "green" && to === "red") return "Red alert";
  // Recoveries
  if (from === "red" && to === "yellow") return "Recovered";
  if (from === "yellow" && to === "green") return "Safe";
  if (from === "red" && to === "green") return "Safe";
  return null;
}
