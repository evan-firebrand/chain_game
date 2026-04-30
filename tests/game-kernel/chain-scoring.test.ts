/**
 * Spec tests for chain scoring math.
 *
 * These are both documentation (what's correct) and regression guards
 * (stays correct forever). If any test fails, the kernel has a length-
 * dependent bug — treat as a P0 finding before continuing.
 *
 * Score formula: mergeValue(values) × chainLength
 *   where mergeValue = smallest power of 2 >= sum(values)
 */

import { describe, it, expect } from "vitest";
import { mergeValue } from "../../src/game/chain";

function score(values: number[]): number {
  return mergeValue(values) * values.length;
}

describe("mergeValue", () => {
  it("sum <= 1 returns 2", () => {
    expect(mergeValue([1])).toBe(2);
    expect(mergeValue([0])).toBe(2);
  });

  it("exact powers of 2", () => {
    expect(mergeValue([2, 2])).toBe(4);       // sum=4 = 2^2
    expect(mergeValue([2, 2, 4])).toBe(8);    // sum=8 = 2^3
    expect(mergeValue([4, 4])).toBe(8);       // sum=8 = 2^3
    expect(mergeValue([8, 8])).toBe(16);      // sum=16 = 2^4
  });

  it("sums just above a power of 2 round up", () => {
    // sum=5 → 2^3=8 (not 4, since 4 < 5)
    expect(mergeValue([3, 2])).toBe(8);
    // sum=20 → 2^5=32 (not 16, since 16 < 20)
    expect(mergeValue([2, 2, 4, 4, 8])).toBe(32);
  });
});

describe("chain scoring at short lengths (current MAX_DEPTH territory)", () => {
  it("length 2: [2,2]", () => {
    // sum=4, mergeValue=4, score=4×2=8
    expect(mergeValue([2, 2])).toBe(4);
    expect(score([2, 2])).toBe(8);
  });

  it("length 3: [2,2,4]", () => {
    // sum=8, mergeValue=8, score=8×3=24
    expect(mergeValue([2, 2, 4])).toBe(8);
    expect(score([2, 2, 4])).toBe(24);
  });

  it("length 5: [2,2,4,4,8]", () => {
    // sum=20, mergeValue=32, score=32×5=160
    expect(mergeValue([2, 2, 4, 4, 8])).toBe(32);
    expect(score([2, 2, 4, 4, 8])).toBe(160);
  });

  it("length 7: [2,2,4,4,8,8,16]", () => {
    // sum=44, mergeValue=64, score=64×7=448
    expect(mergeValue([2, 2, 4, 4, 8, 8, 16])).toBe(64);
    expect(score([2, 2, 4, 4, 8, 8, 16])).toBe(448);
  });
});

describe("chain scoring at designer-length chains (10–20 tiles)", () => {
  it("length 10: all-2s chain", () => {
    // sum=20, mergeValue=32, score=32×10=320
    // A depth-10 all-2s chain scores 2× more than the same length-5 chain (320 vs 160)
    const values = Array(10).fill(2);
    expect(mergeValue(values)).toBe(32);
    expect(score(values)).toBe(320);
  });

  it("length 15: alternating [2,2,4,4,...,256]", () => {
    // sum=764, mergeValue=1024, score=1024×15=15360
    const values = [2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64, 64, 128, 128, 256];
    expect(values.length).toBe(15);
    expect(mergeValue(values)).toBe(1024);
    expect(score(values)).toBe(15360);
  });

  it("length 18: alternating [2,2,...,512,512]", () => {
    // sum=2044, mergeValue=2048, score=2048×18=36864
    const values = [2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64, 64, 128, 128, 256, 256, 512, 512];
    expect(values.length).toBe(18);
    expect(mergeValue(values)).toBe(2048);
    expect(score(values)).toBe(36864);
  });

  it("length 20: all-2s chain", () => {
    // sum=40, mergeValue=64, score=64×20=1280
    const values = Array(20).fill(2);
    expect(mergeValue(values)).toBe(64);
    expect(score(values)).toBe(1280);
  });
});

describe("score growth across depth cap boundary", () => {
  it("all-2s: depth-5 scores 80; depth-10 scores 320 — 4× uplift", () => {
    // [2,2,2,2,2]: sum=10, mergeValue=16, score=80
    expect(score(Array(5).fill(2))).toBe(80);
    // [2,2,...×10]: sum=20, mergeValue=32, score=320
    expect(score(Array(10).fill(2))).toBe(320);
  });

  it("depth-15 alternating scores 1920× a depth-2 chain", () => {
    const d2 = score([2, 2]);          // 8
    const d15 = score([2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64, 64, 128, 128, 256]); // 15360
    expect(d15 / d2).toBeCloseTo(1920, 0);
  });
});
