import { beforeEach, describe, expect, it } from "vitest";
import { createClass, deleteEmptyClass, findClassByName, listClasses } from "./classes";
import { clearNotified, listNotificationLog, markNotified } from "./notificationLog";
import { getSetting, getThresholds, setSetting, setThresholds } from "./settings";
import { addFile } from "./documentFiles";
import { createTestDb } from "./testDb";
import type { Db } from "./types";
import { createVersion, listVersions, type NewVersion } from "./versions";

const version = (class_id: number, issue_date: string, expiry_date: string | null = null): NewVersion => ({
  class_id,
  issue_date,
  expiry_date,
  issuing_authority: "ILT",
  document_number: "123",
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

  it("lists the files of each version in order", async () => {
    const id = await createClass(db, "Paspoort", "Identity");
    const v = await createVersion(db, version(id, "2020-01-01"));
    await addFile(db, v, { file_path: "files/back.jpg", original_filename: "back.jpg" }, 1);
    await addFile(db, v, { file_path: "files/front.jpg", original_filename: "front.jpg" }, 0);
    const [row] = await listVersions(db);
    expect(row.files.map((f) => f.original_filename)).toEqual(["front.jpg", "back.jpg"]);
    expect(row).not.toHaveProperty("file_path");
  });

  it("refuses to delete a version that still has file records only through deleteVersion", async () => {
    const id = await createClass(db, "ECDIS", "STCW");
    const v = await createVersion(db, version(id, "2020-01-01"));
    await addFile(db, v, { file_path: "files/a.pdf", original_filename: null }, 0);
    await expect(db.execute("DELETE FROM document_version WHERE id = $1", [v])).rejects.toThrow();
  });
});

describe("migration 0002 (document files)", () => {
  it("moves the single file of each version into document_file", async () => {
    const db = createTestDb(1);
    await db.execute("INSERT INTO document_class (name, category) VALUES ('BST', 'STCW')");
    await db.execute(
      "INSERT INTO document_version (class_id, issue_date, file_path, original_filename) VALUES (1, '2021-01-01', 'files/1.pdf', 'BST.pdf')",
    );
    await db.execute("INSERT INTO document_version (class_id, issue_date) VALUES (1, '2016-01-01')");
    db.migrateRest();
    const versions = await listVersions(db);
    expect(versions.find((v) => v.id === 1)?.files).toMatchObject([{ file_path: "files/1.pdf", original_filename: "BST.pdf", position: 0 }]);
    expect(versions.find((v) => v.id === 2)?.files).toEqual([]);
    expect(await db.select("SELECT file_path FROM document_version WHERE file_path IS NOT NULL")).toEqual([]);
  });
});
