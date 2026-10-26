import { describe, expect, it } from "vitest";
import { daysInWindow, monthsBefore, serviceDays, sortServices, summarizeSeaTime, yearsBefore, type SeaService } from "./seaTime";

const s = (id: number, on: string, off: string | null, rank: string | null = "AB", type: SeaService["vessel_type"] = "cargo"): SeaService => ({
  id, vessel_name: `Ship ${id}`, vessel_type: type, imo_number: null, rank, sign_on: on, sign_off: off, notes: null, created_at: "", updated_at: "",
});

describe("sea time", () => {
  it("counts both the sign-on and sign-off day", () => {
    expect(serviceDays(s(1, "2026-01-01", "2026-01-01"), "2026-10-26")).toBe(1);
    expect(serviceDays(s(1, "2026-01-01", "2026-01-31"), "2026-10-26")).toBe(31);
  });
  it("counts a current period up to today, and future periods not at all", () => {
    expect(serviceDays(s(1, "2026-10-20", null), "2026-10-26")).toBe(7);
    expect(serviceDays(s(1, "2026-11-01", "2026-12-01"), "2026-10-26")).toBe(0);
  });
  it("does not count overlapping days twice", () => {
    const list = [s(1, "2026-01-01", "2026-01-31"), s(2, "2026-01-20", "2026-02-10"), s(3, "2026-02-11", "2026-02-12")];
    expect(daysInWindow(list, "2026-01-01", "2026-12-31")).toBe(43);
    expect(daysInWindow(list, "2026-02-01", "2026-02-05")).toBe(5);
  });
  it("goes back whole years and months", () => {
    expect(yearsBefore("2026-10-26", 5)).toBe("2021-10-26");
    expect(yearsBefore("2028-02-29", 5)).toBe("2023-02-28");
    expect(monthsBefore("2026-08-31", 6)).toBe("2026-02-28");
    expect(monthsBefore("2026-03-15", 6)).toBe("2025-09-15");
  });
  it("summarizes the last five years for revalidation", () => {
    const list = [s(1, "2019-01-01", "2019-12-31", "AB"), s(2, "2022-01-01", "2022-06-30", "OOW", "tanker"), s(3, "2026-09-01", null, "OOW", "tanker")];
    const sum = summarizeSeaTime(list, "2026-10-26");
    expect(sum.totalDays).toBe(365 + 181 + 56);
    expect(sum.lastFiveYears).toBe(181 + 56);
    expect(sum.missingForRevalidation).toBe(365 - 237);
    expect(sum.lastSixMonths).toBe(56);
    expect(sum.byRank).toEqual([["AB", 365], ["OOW", 237]]);
    expect(sum.byVesselType).toEqual([["cargo", 365], ["tanker", 237]]);
    expect(sum.aboard?.id).toBe(3);
  });
  it("lists newest first", () => {
    expect(sortServices([s(1, "2020-01-01", null), s(2, "2024-01-01", null)]).map((x) => x.id)).toEqual([2, 1]);
  });
});
