import { describe, expect, it } from "vitest";
import { nl } from "../i18n/nl";
import { buildCalendar } from "./calendar";
import { buildOverview } from "./domain/overview";
import type { DocumentClass, DocumentVersion } from "./domain/types";

const cls = (id: number, name: string): DocumentClass => ({ id, name, category: "STCW", created_at: "" });
const ver = (id: number, class_id: number, expiry: string | null, number: string | null = null): DocumentVersion => ({
  id, class_id, issue_date: "2021-11-01", expiry_date: expiry, issuing_authority: "Falck, Rotterdam", document_number: number, notes: null, created_at: "", updated_at: "", files: [],
});

describe("calendar export", () => {
  const items = buildOverview([cls(1, "Basic Safety Training"), cls(2, "Monsterboek")], [ver(7, 1, "2026-11-15", "NL;1"), ver(8, 2, null)], "2026-10-26");
  const ics = buildCalendar(items, [30, 0], nl, new Date("2026-10-26T10:00:00Z"));
  const lines = ics.split("\r\n");

  it("writes one all-day event per expiring document, with a stable UID", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines).toContain("UID:vaarpapieren-version-7@vaarpapieren");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261115");
    expect(lines).toContain("DTEND;VALUE=DATE:20261116");
    expect(lines).toContain("DTSTAMP:20261026T100000Z");
  });
  it("adds a reminder per threshold, at 09:00 on the day itself", () => {
    expect(lines).toContain("TRIGGER;RELATED=START:-P30D");
    expect(lines).toContain("TRIGGER;RELATED=START:PT9H");
  });
  it("escapes special characters and folds long lines", () => {
    expect(ics).toContain("Nummer: NL\;1");
    expect(ics).toContain("Falck\\, Rotterdam");
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
