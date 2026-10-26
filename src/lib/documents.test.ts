import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClass, listClasses } from "./db/classes";
import { createTestDb } from "./db/testDb";
import type { Db } from "./db/types";
import { createVersion, listVersions } from "./db/versions";
import { deleteDocumentVersion, NO_FILE_CHANGES, saveNewDocument, updateDocument } from "./documents";
import { editFormFrom, type DocumentForm } from "./domain/documentForm";
import { importDocumentFile, removeDocumentFile } from "./files";

let copies = 0;
vi.mock("./files", () => ({
  importDocumentFile: vi.fn(async (source: string) => ({
    file_path: `files/${++copies}.pdf`,
    original_filename: source.split("/").pop(),
  })),
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

let db: Db;
beforeEach(() => {
  db = createTestDb();
  copies = 0;
  vi.clearAllMocks();
});

describe("saveNewDocument", () => {
  it("creates the class, the version and its files in order", async () => {
    const { classId } = await saveNewDocument(db, form, valid, ["/Users/me/front.pdf", "/Users/me/back.pdf"]);
    expect(importDocumentFile).toHaveBeenCalledTimes(2);
    const [version] = await listVersions(db);
    expect(version).toMatchObject({ class_id: classId, issuing_authority: "Falck", document_number: null });
    expect(version.files.map((f) => [f.file_path, f.original_filename, f.position])).toEqual([
      ["files/1.pdf", "front.pdf", 0],
      ["files/2.pdf", "back.pdf", 1],
    ]);
  });

  it("adds a version to an existing class without files", async () => {
    const { classId } = await saveNewDocument(db, form, valid, []);
    await saveNewDocument(db, { ...form, classChoice: classId }, { issueDate: "2026-11-01", expiryDate: "2031-11-01" }, []);
    expect(await listClasses(db)).toHaveLength(1);
    expect((await listVersions(db)).map((v) => v.files)).toEqual([[], []]);
  });

  it("undoes the new class and the copies when the version cannot be saved", async () => {
    await expect(saveNewDocument(db, form, { issueDate: "2021-11-01", expiryDate: "2020-01-01" }, ["/a.pdf", "/b.pdf"])).rejects.toThrow();
    expect(await listClasses(db)).toEqual([]);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
    expect(removeDocumentFile).toHaveBeenCalledWith("files/2.pdf");
  });

  it("removes the copies made so far when a later copy fails", async () => {
    vi.mocked(importDocumentFile).mockResolvedValueOnce({ file_path: "files/a.pdf", original_filename: "a.pdf" });
    vi.mocked(importDocumentFile).mockRejectedValueOnce(new Error("disk full"));
    await expect(saveNewDocument(db, form, valid, ["/a.pdf", "/b.pdf"])).rejects.toThrow("disk full");
    expect(removeDocumentFile).toHaveBeenCalledWith("files/a.pdf");
    expect(await listClasses(db)).toEqual([]);
  });
});

describe("updateDocument", () => {
  async function setup() {
    await saveNewDocument(db, form, valid, ["/Users/me/front.pdf", "/Users/me/back.pdf"]);
    const [cls] = await listClasses(db);
    const [version] = await listVersions(db);
    vi.clearAllMocks();
    return { cls, version };
  }

  it("updates version fields and the class, keeping the files", async () => {
    const { cls, version } = await setup();
    const edit = { ...editFormFrom(cls, version), className: "BST", documentNumber: "A-1" };
    await updateDocument(db, cls, version, edit, { issueDate: "2021-11-02", expiryDate: "2026-11-02" }, NO_FILE_CHANGES);
    expect((await listClasses(db))[0].name).toBe("BST");
    const [updated] = await listVersions(db);
    expect(updated).toMatchObject({ document_number: "A-1", issue_date: "2021-11-02" });
    expect(updated.files).toHaveLength(2);
    expect(removeDocumentFile).not.toHaveBeenCalled();
  });

  it("adds files after the existing ones and removes the chosen ones afterwards", async () => {
    const { cls, version } = await setup();
    await updateDocument(db, cls, version, editFormFrom(cls, version), valid, { remove: [version.files[0]], add: ["/scan.pdf"] });
    const [updated] = await listVersions(db);
    expect(updated.files.map((f) => [f.original_filename, f.position])).toEqual([
      ["back.pdf", 1],
      ["scan.pdf", 2],
    ]);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/1.pdf");
  });

  it("keeps everything when the edit fails", async () => {
    const { cls, version } = await setup();
    await createClass(db, "Paspoort", "Identity");
    const edit = { ...editFormFrom(cls, version), className: "Paspoort" };
    await expect(updateDocument(db, cls, version, edit, valid, { remove: [version.files[0]], add: ["/new.pdf"] })).rejects.toThrow();
    expect(removeDocumentFile).toHaveBeenCalledTimes(1);
    expect(removeDocumentFile).toHaveBeenCalledWith("files/3.pdf");
    expect((await listVersions(db))[0].files).toHaveLength(2);
  });

  it("lets reminders start over when the expiry date changes", async () => {
    const { cls, version } = await setup();
    await db.execute("INSERT INTO notification_log (version_id, threshold_days) VALUES ($1, 90)", [version.id]);
    await updateDocument(db, cls, version, editFormFrom(cls, version), valid, NO_FILE_CHANGES);
    expect(await db.select<unknown[]>("SELECT * FROM notification_log")).toHaveLength(1);
    await updateDocument(db, cls, version, editFormFrom(cls, version), { ...valid, expiryDate: "2031-11-01" }, NO_FILE_CHANGES);
    expect(await db.select<unknown[]>("SELECT * FROM notification_log")).toEqual([]);
  });
});

describe("deleteDocumentVersion", () => {
  it("deletes one version with its files, keeping the others", async () => {
    const { classId } = await saveNewDocument(db, form, valid, ["/Users/me/BST.pdf", "/Users/me/BST-2.pdf"]);
    await createVersion(db, { class_id: classId, issue_date: "2026-11-01", expiry_date: null, issuing_authority: null, document_number: null, notes: null });
    const old = (await listVersions(db)).find((v) => v.files.length > 0)!;
    await db.execute("INSERT INTO notification_log (version_id, threshold_days) VALUES ($1, 90)", [old.id]);
    vi.clearAllMocks();
    await deleteDocumentVersion(db, old, false);
    expect((await listVersions(db)).map((v) => v.issue_date)).toEqual(["2026-11-01"]);
    expect(await db.select<unknown[]>("SELECT * FROM document_file")).toEqual([]);
    expect(removeDocumentFile).toHaveBeenCalledTimes(2);
  });

  it("deletes the class with its last version only when asked", async () => {
    await saveNewDocument(db, form, valid, []);
    const [version] = await listVersions(db);
    await deleteDocumentVersion(db, version, false);
    expect(await listClasses(db)).toHaveLength(1);

    await saveNewDocument(db, { ...form, newClassName: "ECDIS" }, valid, []);
    const [second] = await listVersions(db);
    await deleteDocumentVersion(db, second, true);
    expect((await listClasses(db)).map((c) => c.name)).toEqual(["Basic Safety Training"]);
  });
});
