# sim-harness/strategies

Three automated player strategies for the simulation harness.

Each strategy implements the `Strategy` interface (defined in `sim-harness/types.ts`):
```typescript
interface Strategy {
  selectChain(state: GameState, config: GameConfig): CommitChainAction | null;
}
```

| Strategy | Behavior |
|---|---|
| `random.ts` | Randomly selects any legal chain start, then randomly extends it |
| `greedy.ts` | Among all legal chains, selects the one with the highest immediate result value |
| `heuristic.ts` | Approximates designed-intent play: balances tier advancement vs board space management |

The `heuristic` strategy encodes design assumptions about what "good play" looks like. Any heuristic weighting decisions require Evan sign-off (they affect what "designed intent" means in simulation results).
