import { describe, expect, it } from "vitest";
import type { DocumentVersion } from "./types";
import { currentVersion, groupByClass, isSuperseded, sortVersionsNewestFirst } from "./versions";

const v = (id: number, class_id: number, issue_date: string): DocumentVersion => ({
  id,
  class_id,
  issue_date,
  expiry_date: null,
  issuing_authority: null,
  document_number: null,
  notes: null,
  created_at: "",
  updated_at: "",
  files: [],
});

describe("versions", () => {
  const list = [v(1, 1, "2020-01-01"), v(2, 1, "2025-06-01"), v(3, 1, "2022-03-01")];

  it("picks the newest issue date as current", () => {
    expect(currentVersion(list)?.id).toBe(2);
  });
  it("is not fooled by insertion order", () => {
    expect(currentVersion([v(9, 1, "2019-01-01"), v(1, 1, "2024-01-01")])?.id).toBe(1);
  });
  it("breaks ties with the highest id", () => {
    expect(currentVersion([v(1, 1, "2024-01-01"), v(5, 1, "2024-01-01")])?.id).toBe(5);
  });
  it("returns undefined for no versions", () => {
    expect(currentVersion([])).toBeUndefined();
  });
  it("sorts newest first without mutating the input", () => {
    expect(sortVersionsNewestFirst(list).map((x) => x.id)).toEqual([2, 3, 1]);
    expect(list.map((x) => x.id)).toEqual([1, 2, 3]);
  });
  it("marks older versions as superseded", () => {
    expect(isSuperseded(list[0], list)).toBe(true);
    expect(isSuperseded(list[1], list)).toBe(false);
  });
  it("groups per class", () => {
    const groups = groupByClass([...list, v(4, 2, "2021-01-01")]);
    expect(groups.get(1)?.map((x) => x.id)).toEqual([2, 3, 1]);
    expect(groups.get(2)?.map((x) => x.id)).toEqual([4]);
  });
});
