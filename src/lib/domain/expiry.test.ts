import { describe, expect, it } from "vitest";
import { daysUntilExpiry, expiryStatus } from "./expiry";

describe("daysUntilExpiry", () => {
  it("returns null without expiry date", () => {
    expect(daysUntilExpiry(null, "2026-10-25")).toBeNull();
  });
  it("is 0 on the expiry day and negative afterwards", () => {
    expect(daysUntilExpiry("2026-10-25", "2026-10-25")).toBe(0);
    expect(daysUntilExpiry("2026-10-24", "2026-10-25")).toBe(-1);
    expect(daysUntilExpiry("2027-01-23", "2026-10-25")).toBe(90);
  });
});

describe("expiryStatus", () => {
  it.each([
    [null, "no-expiry"],
    [91, "valid"],
    [90, "warning"],
    [31, "warning"],
    [30, "critical"],
    [0, "critical"],
    [-1, "expired"],
  ] as const)("%s days -> %s", (days, status) => {
    expect(expiryStatus(days)).toBe(status);
  });
});
