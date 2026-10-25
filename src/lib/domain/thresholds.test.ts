import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, decideNotification, normalizeThresholds, reachedThresholds } from "./thresholds";

describe("thresholds", () => {
  it("normalizes: unique, no negatives, descending", () => {
    expect(normalizeThresholds([7, 30, 7, -1, 1.5, 0])).toEqual([30, 7, 0]);
  });
  it("reaches thresholds at or above the days left", () => {
    expect(reachedThresholds(100, DEFAULT_THRESHOLDS)).toEqual([]);
    expect(reachedThresholds(90, DEFAULT_THRESHOLDS)).toEqual([90]);
    expect(reachedThresholds(29, DEFAULT_THRESHOLDS)).toEqual([90, 60, 30]);
    expect(reachedThresholds(0, DEFAULT_THRESHOLDS)).toEqual(DEFAULT_THRESHOLDS);
    expect(reachedThresholds(-1, DEFAULT_THRESHOLDS)).toEqual([]);
  });
});

describe("decideNotification", () => {
  it("does nothing without expiry date or before the first threshold", () => {
    expect(decideNotification(null, DEFAULT_THRESHOLDS, [])).toEqual({ notify: null, markSent: [] });
    expect(decideNotification(120, DEFAULT_THRESHOLDS, [])).toEqual({ notify: null, markSent: [] });
  });
  it("notifies once per threshold", () => {
    expect(decideNotification(90, DEFAULT_THRESHOLDS, [])).toEqual({ notify: 90, markSent: [90] });
    expect(decideNotification(89, DEFAULT_THRESHOLDS, [90])).toEqual({ notify: null, markSent: [] });
    expect(decideNotification(60, DEFAULT_THRESHOLDS, [90])).toEqual({ notify: 60, markSent: [60] });
  });
  it("sends one message for several skipped thresholds and logs all of them", () => {
    expect(decideNotification(5, DEFAULT_THRESHOLDS, [])).toEqual({
      notify: 7,
      markSent: [90, 60, 30, 14, 7],
    });
  });
  it("notifies on the expiry day, not after", () => {
    expect(decideNotification(0, DEFAULT_THRESHOLDS, [90, 60, 30, 14, 7, 1])).toEqual({ notify: 0, markSent: [0] });
    expect(decideNotification(-3, DEFAULT_THRESHOLDS, [])).toEqual({ notify: null, markSent: [] });
  });
  it("respects custom thresholds", () => {
    expect(decideNotification(20, [45, 20], [])).toEqual({ notify: 20, markSent: [45, 20] });
  });
});
