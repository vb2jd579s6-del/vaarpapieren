import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClass, listClasses } from "./db/classes";
import { createTestDb } from "./db/testDb";
import { createVersion } from "./db/versions";
import type { Db } from "./db/types";
import { listVersions } from "./db/versions";
import { deleteDocumentVersion, saveNewDocument, updateDocument } from "./documents";
import { editFormFrom, type DocumentForm } from "./domain/documentForm";
import { importDocumentFile, removeDocumentFile } from "./files";

vi.mock("./files", () => ({
  importDocumentFile: vi.fn(async () => ({ file_path: "files/1.pdf", original_filename: "BST.pdf" })),
  removeDocumentFile: vi.fn(async () => {}),
}));

const form: DocumentForm = {
  classChoice: "new",
  newClassName: "Basic Safety Training",
  newClassCategory: "STCW",
  issuingAuthority: " Falck ",
  documentNumber: "",
  issueDate: "01-11-2021",
  noExpiry: false,
  expiryDate: "01-11-2026",
  notes: "",
};
const valid = { issueDate: "2021-11-01", expiryDate: "2026-11-01" };

describe("saveNewDocument", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("creates the class and the version with the copied file", async () => {
    const { classId } = await saveNewDocument(db, form, valid, "/Users/me/BST.pdf");
    expect(importDocumentFile).toHaveBeenCalledWith("/Users/me/BST.pdf");
    expect(await listVersions(db)).toMatchObject([
      { class_id: classId, issuing_authority: "Falck", document_number: null, file_path: "files/1.pdf", original_filename: "BST.pdf" },
    ]);
  });

  it("adds a version to an existing class without a file", async () => {
    const { classId } = await saveNewDocument(db, form, valid, null);
    await saveNewDocument(db, { ...form, classChoice: classId }, { issueDate: "2026-11-01", expiryDate: "2031-11-01" }, null);
    expect(await listClasses(db)).toHaveLength(1);
    expect(await listVersions(db)).toHaveLength(2);
  });

  it("undoes the new class and the copied file when the version cannot be saved", async () => {
    await expect(saveNewDocument(db, form, { issueDate: "2021-11-01", expiryDate: "2020-01-01" }, "/x.pdf")).rejects.toThrow();
    expect(await listClasses(db)).toEqual([]);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
  });
});

describe("updateDocument", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  async function setup() {
    const { classId } = await saveNewDocument(db, form, valid, "/Users/me/BST.pdf");
    const [cls] = await listClasses(db);
    const [version] = await listVersions(db);
    vi.clearAllMocks();
    return { classId, cls, version };
  }

  it("updates version fields and the class, keeping the file", async () => {
    const { cls, version } = await setup();
    const edit = { ...editFormFrom(cls, version), className: "BST", documentNumber: "A-1" };
    await updateDocument(db, cls, version, edit, { issueDate: "2021-11-02", expiryDate: "2026-11-02" }, { kind: "keep" });
    expect((await listClasses(db))[0].name).toBe("BST");
    expect((await listVersions(db))[0]).toMatchObject({ document_number: "A-1", issue_date: "2021-11-02", file_path: "files/1.pdf" });
    expect(removeDocumentFile).not.toHaveBeenCalled();
  });

  it("lets reminders start over when the expiry date changes", async () => {
    const { cls, version } = await setup();
    await db.execute("INSERT INTO notification_log (version_id, threshold_days) VALUES ($1, 90)", [version.id]);
    await updateDocument(db, cls, version, editFormFrom(cls, version), valid, { kind: "keep" });
    expect(await db.select<unknown[]>("SELECT * FROM notification_log")).toHaveLength(1);
    await updateDocument(db, cls, version, editFormFrom(cls, version), { ...valid, expiryDate: "2031-11-01" }, { kind: "keep" });
    expect(await db.select<unknown[]>("SELECT * FROM notification_log")).toEqual([]);
  });

  it("removes the old file only after replacing it", async () => {
    const { cls, version } = await setup();
    vi.mocked(importDocumentFile).mockResolvedValueOnce({ file_path: "files/2.pdf", original_filename: "new.pdf" });
    await updateDocument(db, cls, version, editFormFrom(cls, version), valid, { kind: "replace", source: "/new.pdf" });
    expect((await listVersions(db))[0]).toMatchObject({ file_path: "files/2.pdf", original_filename: "new.pdf" });
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
  });

  it("keeps the old file when the edit fails", async () => {
    const { cls, version } = await setup();
    await createClass(db, "Paspoort", "Identity");
    vi.mocked(importDocumentFile).mockResolvedValueOnce({ file_path: "files/2.pdf", original_filename: "new.pdf" });
    const edit = { ...editFormFrom(cls, version), className: "Paspoort" };
    await expect(updateDocument(db, cls, version, edit, valid, { kind: "replace", source: "/new.pdf" })).rejects.toThrow();
    expect(removeDocumentFile).toHaveBeenCalledTimes(1);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/2.pdf");
    expect((await listVersions(db))[0].file_path).toBe("files/1.pdf");
  });
});

describe("deleteDocumentVersion", () => {
  let db: Db;
  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("deletes one version and its file, keeping the others", async () => {
    const { classId } = await saveNewDocument(db, form, valid, "/Users/me/BST.pdf");
    await createVersion(db, { class_id: classId, issue_date: "2026-11-01", expiry_date: null, issuing_authority: null, document_number: null, file_path: null, original_filename: null, notes: null });
    const old = (await listVersions(db)).find((v) => v.file_path)!;
    await db.execute("INSERT INTO notification_log (version_id, threshold_days) VALUES ($1, 90)", [old.id]);
    await deleteDocumentVersion(db, old, false);
    expect((await listVersions(db)).map((v) => v.issue_date)).toEqual(["2026-11-01"]);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
  });

  it("deletes the class with its last version only when asked", async () => {
    await saveNewDocument(db, form, valid, null);
    const [version] = await listVersions(db);
    await deleteDocumentVersion(db, version, false);
    expect(await listClasses(db)).toHaveLength(1);

    await saveNewDocument(db, { ...form, newClassName: "ECDIS" }, valid, null);
    const [second] = await listVersions(db);
    await deleteDocumentVersion(db, second, true);
    expect((await listClasses(db)).map((c) => c.name)).toEqual(["Basic Safety Training"]);
    expect(removeDocumentFile).not.toHaveBeenCalled();
  });
});
