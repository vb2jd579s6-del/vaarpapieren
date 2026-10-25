import { describe, expect, it } from "vitest";
import { groupSentByVersion, planNotifications } from "./notifications";
import { buildOverview } from "./overview";
import { DEFAULT_THRESHOLDS } from "./thresholds";
import type { DocumentClass, DocumentVersion } from "./types";

const cls = (id: number, name: string): DocumentClass => ({ id, name, category: "STCW", created_at: "" });
const ver = (id: number, class_id: number, issue_date: string, expiry_date: string | null): DocumentVersion => ({
  id, class_id, issue_date, expiry_date, issuing_authority: null, document_number: null,
  file_path: null, original_filename: null, notes: null, created_at: "", updated_at: "",
});

const TODAY = "2026-10-25";
const classes = [cls(1, "BST"), cls(2, "Paspoort"), cls(3, "Monsterboek"), cls(4, "ECDIS")];
const versions = [
  ver(1, 1, "2021-11-24", "2026-11-24"), // current, 30 days left
  ver(2, 1, "2016-11-01", "2026-10-30"), // superseded, 5 days left: never notifies
  ver(3, 2, "2019-01-10", "2029-01-10"), // far away
  ver(4, 3, "2018-01-01", null), // never expires
  ver(5, 4, "2020-01-01", "2026-10-20"), // expired
];
const items = buildOverview(classes, versions, TODAY);

describe("planNotifications", () => {
  it("only notifies about current versions inside a threshold", () => {
    expect(planNotifications(items, DEFAULT_THRESHOLDS, new Map())).toEqual([
      { versionId: 1, className: "BST", expiryDate: "2026-11-24", daysLeft: 30, markSent: [90, 60, 30] },
    ]);
  });
  it("does not repeat a logged threshold", () => {
    const sent = groupSentByVersion([90, 60, 30].map((t) => ({ version_id: 1, threshold_days: t })));
    expect(planNotifications(items, DEFAULT_THRESHOLDS, sent)).toEqual([]);
  });
  it("uses the configured thresholds", () => {
    expect(planNotifications(items, [14, 7], new Map())).toEqual([]);
  });
});

describe("groupSentByVersion", () => {
  it("groups thresholds per version", () => {
    const map = groupSentByVersion([
      { version_id: 1, threshold_days: 90 },
      { version_id: 2, threshold_days: 30 },
      { version_id: 1, threshold_days: 60 },
    ]);
    expect(map.get(1)).toEqual([90, 60]);
    expect(map.get(2)).toEqual([30]);
  });
});
