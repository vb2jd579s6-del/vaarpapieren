import { describe, expect, it } from "vitest";
import { createClass, listClasses } from "./db/classes";
import { addFile } from "./db/documentFiles";
import { listNotificationLog, markNotified } from "./db/notificationLog";
import { getSetting, setSetting } from "./db/settings";
import { createTestDb } from "./db/testDb";
import { addSeaService, listSeaService } from "./db/seaService";
import { createVersion, listVersions } from "./db/versions";
import { buildExport, exportFileName, InvalidExportError, parseExport, replaceWithImport } from "./transfer";

async function filledDb() {
  const db = createTestDb();
  const bst = await createClass(db, "Basic Safety Training", "STCW");
  const passport = await createClass(db, "Paspoort", "Identity");
  const v1 = await createVersion(db, { class_id: bst, issue_date: "2021-11-01", expiry_date: "2026-11-01", issuing_authority: "Falck", document_number: "NL-1", notes: "notitie é ü" });
  const v2 = await createVersion(db, { class_id: passport, issue_date: "2019-01-10", expiry_date: null, issuing_authority: null, document_number: null, notes: null });
  await addFile(db, v1, { file_path: "files/1.pdf", original_filename: "BST.pdf" }, 0);
  await addFile(db, v1, { file_path: "files/2.jpg", original_filename: "achterkant.jpg" }, 1);
  await addFile(db, v2, { file_path: "files/3.png", original_filename: null }, 0);
  await markNotified(db, v1, [90, 60]);
  await setSetting(db, "language", "de");
  await setSetting(db, "notification_thresholds", "[30,7]");
  await setSetting(db, "activated", "1");
  await addSeaService(db, { vessel_name: "MT Voorbeeld", vessel_type: "tanker", imo_number: "9123456", rank: "OOW", sign_on: "2025-01-01", sign_off: "2025-04-30", notes: null });
  await addSeaService(db, { vessel_name: "MV Nu", vessel_type: null, imo_number: null, rank: null, sign_on: "2026-09-01", sign_off: null, notes: "aan boord" });
  return db;
}

describe("export and import", () => {
  it("moves everything except the activation to another database", async () => {
    const source = await filledDb();
    const manifest = await buildExport(source, "1.2.0", new Date("2026-10-26T12:00:00Z"));
    expect(manifest).toMatchObject({ format: "vaarpapieren-export", formatVersion: 2, appVersion: "1.2.0", exportedAt: "2026-10-26T12:00:00.000Z" });
    expect(manifest.settings).toEqual({ language: "de", notification_thresholds: "[30,7]" });

    // The target already has other data, which the import replaces.
    const target = createTestDb();
    const other = await createClass(target, "Oud", "Other");
    await createVersion(target, { class_id: other, issue_date: "2000-01-01", expiry_date: null, issuing_authority: null, document_number: null, notes: null });
    await setSetting(target, "activated", "1");
    await setSetting(target, "language", "nl");

    await replaceWithImport(target, parseExport(JSON.stringify(manifest)));

    expect(await listClasses(target)).toEqual(await listClasses(source));
    expect(await listVersions(target)).toEqual(await listVersions(source));
    expect(await listNotificationLog(target)).toEqual(await listNotificationLog(source));
    expect(await listSeaService(target)).toEqual(await listSeaService(source));
    expect(await getSetting(target, "language")).toBe("de");
    expect(await getSetting(target, "activated")).toBe("1");
    // New records after the import do not collide with imported ids.
    const next = await createClass(target, "Nieuw", "Other");
    expect(next).toBeGreaterThan(Math.max(...manifest.classes.map((c) => c.id)));
  });

  it("refuses broken or foreign files before touching anything", () => {
    expect(() => parseExport("nonsense")).toThrow(InvalidExportError);
    expect(() => parseExport(JSON.stringify({ format: "something-else" }))).toThrow(InvalidExportError);
    const base = { format: "vaarpapieren-export", formatVersion: 1, appVersion: "1", exportedAt: "", classes: [], versions: [], files: [], notificationLog: [], settings: {} };
    expect(parseExport(JSON.stringify(base))).toMatchObject({ classes: [] });
    expect(() => parseExport(JSON.stringify({ ...base, formatVersion: 99 }))).toThrow(/newer version/);
    expect(() =>
      parseExport(JSON.stringify({ ...base, versions: [{ id: 1, class_id: 5, issue_date: "2020-01-01", expiry_date: null, issuing_authority: null, document_number: null, notes: null }] })),
    ).toThrow(/version/);
    const cls = { id: 1, name: "X", category: "STCW", created_at: "" };
    const ver = { id: 1, class_id: 1, issue_date: "2020-01-01", expiry_date: null, issuing_authority: null, document_number: null, notes: null, created_at: "", updated_at: "" };
    const file = (file_path: string) => ({ id: 1, version_id: 1, file_path, original_filename: null, position: 0, created_at: "" });
    expect(() => parseExport(JSON.stringify({ ...base, classes: [cls], versions: [ver], files: [file("../../etc/passwd")] }))).toThrow(/file/);
    expect(() => parseExport(JSON.stringify({ ...base, classes: [cls], versions: [ver], files: [file("files\\\\x.pdf")] }))).toThrow(/file/);
    expect(parseExport(JSON.stringify({ ...base, classes: [cls], versions: [ver], files: [file("files/x.pdf")] })).files).toHaveLength(1);
  });

  it("still imports version 1 files, which have no sea service", async () => {
    const v1 = { format: "vaarpapieren-export", formatVersion: 1, appVersion: "1.2.0", exportedAt: "", classes: [], versions: [], files: [], notificationLog: [], settings: {} };
    const parsed = parseExport(JSON.stringify(v1));
    expect(parsed.seaService).toEqual([]);
    const db = createTestDb();
    await addSeaService(db, { vessel_name: "Oud", vessel_type: null, imo_number: null, rank: null, sign_on: "2020-01-01", sign_off: null, notes: null });
    await replaceWithImport(db, parsed);
    expect(await listSeaService(db)).toEqual([]);
  });

  it("names the file after the date", () => {
    expect(exportFileName(new Date(2026, 9, 5))).toBe("Vaarpapieren-2026-10-05.vaarpapieren");
  });
});
