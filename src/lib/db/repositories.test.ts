import { beforeEach, describe, expect, it } from "vitest";
import { createClass, deleteEmptyClass, findClassByName, listClasses } from "./classes";
import { clearNotified, listNotificationLog, markNotified } from "./notificationLog";
import { getSetting, getThresholds, setSetting, setThresholds } from "./settings";
import { createTestDb } from "./testDb";
import type { Db } from "./types";
import { createVersion, listVersions, type NewVersion } from "./versions";

const version = (class_id: number, issue_date: string, expiry_date: string | null = null): NewVersion => ({
  class_id,
  issue_date,
  expiry_date,
  issuing_authority: "ILT",
  document_number: "123",
  file_path: null,
  original_filename: null,
  notes: null,
});

describe("repositories", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
  });

  it("creates and finds classes case-insensitively", async () => {
    const id = await createClass(db, "  Basic Safety Training ", "STCW");
    expect((await findClassByName(db, "basic safety training"))?.id).toBe(id);
    expect((await listClasses(db)).map((c) => c.name)).toEqual(["Basic Safety Training"]);
    await expect(createClass(db, "BASIC SAFETY TRAINING", "STCW")).rejects.toThrow();
  });

  it("rejects unknown categories", async () => {
    await expect(createClass(db, "X", "Nope" as never)).rejects.toThrow();
  });

  it("keeps every version of a class", async () => {
    const id = await createClass(db, "Paspoort", "Identity");
    await createVersion(db, version(id, "2016-01-01", "2026-01-01"));
    await createVersion(db, version(id, "2026-01-02", "2036-01-02"));
    const rows = await listVersions(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ class_id: id, issuing_authority: "ILT", expiry_date: "2026-01-01" });
    expect(rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuses versions for missing classes and expiry before issue", async () => {
    await expect(createVersion(db, version(999, "2020-01-01"))).rejects.toThrow();
    const id = await createClass(db, "ECDIS", "STCW");
    await expect(createVersion(db, version(id, "2020-01-01", "2019-01-01"))).rejects.toThrow();
  });

  it("never deletes a class that still has versions", async () => {
    const id = await createClass(db, "GMDSS GOC", "STCW");
    await createVersion(db, version(id, "2020-01-01"));
    await deleteEmptyClass(db, id);
    expect(await listClasses(db)).toHaveLength(1);
    const empty = await createClass(db, "Leeg", "Other");
    await deleteEmptyClass(db, empty);
    expect(await listClasses(db)).toHaveLength(1);
  });

  it("stores settings", async () => {
    expect(await getSetting(db, "overview_view")).toBeUndefined();
    await setSetting(db, "overview_view", "list");
    await setSetting(db, "overview_view", "grid");
    expect(await getSetting(db, "overview_view")).toBe("grid");
  });

  it("stores thresholds, falling back to the defaults", async () => {
    expect(await getThresholds(db)).toEqual([90, 60, 30, 14, 7, 1, 0]);
    await setThresholds(db, [7, 30, 7]);
    expect(await getThresholds(db)).toEqual([30, 7]);
    await setThresholds(db, []);
    expect(await getThresholds(db)).toEqual([]);
    await setSetting(db, "notification_thresholds", "garbage");
    expect(await getThresholds(db)).toEqual([90, 60, 30, 14, 7, 1, 0]);
  });

  it("logs each threshold once per version", async () => {
    const id = await createClass(db, "BST", "STCW");
    const v = await createVersion(db, version(id, "2021-01-01", "2026-01-01"));
    await markNotified(db, v, [90, 60]);
    await markNotified(db, v, [60, 30]);
    expect((await listNotificationLog(db)).map((r) => r.threshold_days).sort()).toEqual([30, 60, 90]);
    await clearNotified(db, v);
    expect(await listNotificationLog(db)).toEqual([]);
  });
});
