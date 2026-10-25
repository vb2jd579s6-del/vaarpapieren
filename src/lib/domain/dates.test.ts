import { describe, expect, it } from "vitest";
import { daysBetween, formatDate, isValidIsoDate, parseDisplayDate, todayIso } from "./dates";

describe("dates", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-10-25", "2026-10-26")).toBe(1);
    expect(daysBetween("2026-10-25", "2026-10-25")).toBe(0);
    expect(daysBetween("2026-10-25", "2026-10-20")).toBe(-5);
  });
  it("is not affected by DST changes", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
  it("handles leap years", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2027-02-28", "2027-03-01")).toBe(1);
  });
  it("validates ISO dates", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("25-10-2026")).toBe(false);
    expect(() => daysBetween("nope", "2026-01-01")).toThrow();
  });
  it("formats as dd-mm-yyyy", () => {
    expect(formatDate("2026-10-05")).toBe("05-10-2026");
    expect(formatDate(null)).toBe("");
  });
  it("gives local today", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("parses dd-mm-yyyy input", () => {
    expect(parseDisplayDate("05-10-2026")).toBe("2026-10-05");
    expect(parseDisplayDate(" 5/1/2026 ")).toBe("2026-01-05");
    expect(parseDisplayDate("29.02.2028")).toBe("2028-02-29");
    expect(parseDisplayDate("29-02-2026")).toBeNull();
    expect(parseDisplayDate("2026-10-05")).toBeNull();
    expect(parseDisplayDate("")).toBeNull();
  });
});
