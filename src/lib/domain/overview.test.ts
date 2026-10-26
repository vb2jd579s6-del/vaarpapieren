import { describe, expect, it } from "vitest";
import { buildOverview, countByGroup, filterOverview, upcomingExpiries } from "./overview";
import type { Category, DocumentClass, DocumentVersion } from "./types";

const cls = (id: number, name: string, category: Category = "STCW"): DocumentClass => ({ id, name, category, created_at: "" });
const ver = (id: number, class_id: number, issue_date: string, expiry_date: string | null): DocumentVersion => ({
  id,
  class_id,
  issue_date,
  expiry_date,
  issuing_authority: null,
  document_number: null,
  file_path: null,
  original_filename: null,
  notes: null,
  created_at: "",
  updated_at: "",
});

const TODAY = "2026-10-25";
const classes = [cls(1, "Paspoort", "Identity"), cls(2, "Basic Safety Training"), cls(3, "Monsterboek", "Other"), cls(4, "Zonder versies")];
const versions = [
  ver(1, 1, "2016-01-01", "2026-01-01"),
  ver(2, 1, "2026-01-02", "2036-01-02"),
  ver(3, 2, "2022-01-01", "2026-11-04"),
  ver(4, 3, "2020-01-01", null),
];

describe("buildOverview", () => {
  const items = buildOverview(classes, versions, TODAY);

  it("shows the current version of each class with versions", () => {
    expect(items.map((i) => [i.documentClass.name, i.current.id])).toEqual([
      ["Basic Safety Training", 3],
      ["Paspoort", 2],
      ["Monsterboek", 4],
    ]);
  });
  it("bases the status on the current version only", () => {
    const passport = items.find((i) => i.documentClass.id === 1)!;
    expect(passport.status).toBe("valid");
    expect(passport.versions.map((v) => v.id)).toEqual([2, 1]);
  });
  it("puts documents without expiry last", () => {
    expect(items[items.length - 1]).toMatchObject({ daysLeft: null, status: "no-expiry" });
    expect(items[0]).toMatchObject({ daysLeft: 10, status: "critical" });
  });
});

describe("filterOverview", () => {
  const items = buildOverview(classes, versions, TODAY);
  it("filters on category and name", () => {
    expect(filterOverview(items, { category: "Identity", query: "" }).map((i) => i.documentClass.id)).toEqual([1]);
    expect(filterOverview(items, { category: null, query: "  SAFETY " }).map((i) => i.documentClass.id)).toEqual([2]);
    expect(filterOverview(items, { category: "STCW", query: "pas" })).toEqual([]);
    expect(filterOverview(items, { category: null, query: "" })).toHaveLength(3);
  });
});

describe("summary", () => {
  const items = buildOverview(classes, versions, TODAY);
  it("counts expired, soon and valid", () => {
    expect(countByGroup(items)).toEqual({ expired: 0, soon: 1, valid: 2 });
    const withExpired = buildOverview([...classes, cls(9, "ECDIS")], [...versions, ver(9, 9, "2020-01-01", "2026-10-01")], TODAY);
    expect(countByGroup(withExpired)).toEqual({ expired: 1, soon: 1, valid: 2 });
  });
  it("filters on a group", () => {
    expect(filterOverview(items, { category: null, query: "", group: "soon" }).map((i) => i.documentClass.id)).toEqual([2]);
    expect(filterOverview(items, { category: null, query: "", group: "valid" }).map((i) => i.documentClass.id)).toEqual([1, 3]);
  });
  it("lists upcoming expiries, not expired or never-expiring ones", () => {
    const withExpired = buildOverview([...classes, cls(9, "ECDIS")], [...versions, ver(9, 9, "2020-01-01", "2026-10-01")], TODAY);
    expect(upcomingExpiries(withExpired, 3).map((i) => i.documentClass.name)).toEqual(["Basic Safety Training", "Paspoort"]);
    expect(upcomingExpiries(withExpired, 1)).toHaveLength(1);
  });
});
