# ADR-0000: Tech Stack

**Status:** Accepted
**Date:** 2026-04-28
**Deciders:** Evan Luckey, Architecture Agent

---

## Context

The project needs a browser-based game with:
- A pure logic module shared between playable game, tuning console, and simulation harness
- Strict type safety (the kernel interface is load-bearing)
- A fast test cycle for the kernel (100% coverage required)
- Minimal setup cost — the design phase is done; we want to build quickly
- No backend, no server — everything runs in the browser
- Mobile-friendly (portrait layout)

---

## Decision

**Language:** TypeScript with `strict: true`

**Build tool:** Vite

**Test framework:** Vitest

**UI approach:** Vanilla TypeScript + Canvas API (v1); no UI framework until v2.5

**Persistence:** None in v1. `localStorage` if session stats are added in v2+.

**Package manager:** npm

---

## Options Considered

### Language

| Option | Pros | Cons |
|---|---|---|
| **TypeScript (strict)** | Catches interface violations at compile time; critical for multi-module architecture; excellent tooling | Slightly more setup than plain JS |
| JavaScript | Less setup | No compile-time safety on the load-bearing kernel interface; agents will make type errors |
| TypeScript (non-strict) | Faster to write | Defeats the purpose; `any` leaks everywhere |

TypeScript strict is mandatory. The kernel interface is the single most important contract in this project. We need compile-time guarantees that agents implement it correctly.

### Build Tool

| Option | Pros | Cons |
|---|---|---|
| **Vite** | Minimal config; excellent TS support; fast HMR; browser-native ESM output; Vitest integrates natively | — |
| Webpack | Mature; widely known | Significant config overhead; slower |
| esbuild | Very fast | Less ecosystem integration |
| No build tool | Zero setup | Cannot use TypeScript; no module bundling |

### Test Framework

| Option | Pros | Cons |
|---|---|---|
| **Vitest** | TypeScript-native; runs in same environment as Vite; excellent coverage tooling; fast | Newer than Jest |
| Jest | Mature; widely known | TypeScript requires extra config; separate environment from Vite |

### UI Approach

| Option | Pros | Cons |
|---|---|---|
| **Vanilla TS + Canvas** | Zero framework overhead; direct control; no hidden state; full Canvas 2D API for game rendering | More verbose for UI widgets |
| React | Component model for console UI | Heavyweight for v1; agents will leak game logic into components |
| Svelte | Lightweight | New learning curve; less testing tooling |

Vanilla TS + Canvas for v1. The Tuning Console (Phase 3) adds some UI complexity but it is a panel with sliders — manageable without a framework. Revisit for v2.5 (aesthetic identity phase) when UI complexity increases.

---

## Rationale

This stack was chosen because it has the least friction between "correct TypeScript kernel" and "browser-playable game." Vite + Vitest is the natural pair. Canvas API gives full control over game rendering without a framework introducing hidden rendering state. The sim harness runs as a Node script against the kernel — no browser APIs needed.

---

## Consequences

**Easier:**
- Any agent can run `npm test` and get immediate, typed feedback
- CI pipeline is simple (tsc + vitest + eslint)
- No framework to learn or update
- Sim harness runs directly in Node without a browser environment

**Harder:**
- UI code is more verbose for widgets (sliders, panels) — acceptable for v1
- Canvas rendering from scratch (no animation library) — intentional for v1; revisit at v2.5

**Off the table:**
- React/Vue component model in v1
- Server-side rendering (not needed)
- Native mobile (web-only is the plan through v3+)

---

## Revisit Conditions

Revisit this decision if:
- v2.5 aesthetic identity phase reveals Canvas API is insufficient for the visual design (consider Pixi.js or similar)
- UI Agent finds vanilla TS widgets for the Tuning Console are unmanageable (consider Svelte for the console layer only)
