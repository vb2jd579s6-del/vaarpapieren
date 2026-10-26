import { createClass, deleteEmptyClass, updateClass } from "./db/classes";
import { addFile, deleteFileRecord } from "./db/documentFiles";
import { clearNotified } from "./db/notificationLog";
import type { Db } from "./db/types";
import { createVersion, deleteVersion, updateVersion } from "./db/versions";
import type { DocumentForm, EditForm, ValidDocument } from "./domain/documentForm";
import type { Category, DocumentClass, DocumentFile, DocumentVersion } from "./domain/types";
import { importDocumentFile, removeDocumentFile, type ImportedFile } from "./files";

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

/** Copies the chosen files into the app, in order; on failure the copies made so far are removed. */
async function importAll(sources: string[]): Promise<ImportedFile[]> {
  const imported: ImportedFile[] = [];
  try {
    for (const source of sources) imported.push(await importDocumentFile(source));
    return imported;
  } catch (err) {
    await removeCopies(imported);
    throw err;
  }
}

async function removeCopies(files: { file_path: string }[]): Promise<void> {
  for (const f of files) await removeDocumentFile(f.file_path).catch(() => {});
}

/** Removes stored files; false when one of them could not be removed. */
async function removeStored(files: { file_path: string }[]): Promise<boolean> {
  let all = true;
  for (const f of files) all = (await removeDocumentFile(f.file_path).then(() => true, () => false)) && all;
  return all;
}

/**
 * Saves a new version (and a new class when chosen). Steps run in order: copy the files, create
 * the class, insert the version and its file records. If a later step fails, what this call
 * created is undone, so a failed save leaves no stray file, record or empty class behind.
 */
export async function saveNewDocument(
  db: Db,
  form: DocumentForm,
  valid: ValidDocument,
  sourceFiles: string[],
): Promise<{ classId: number; versionId: number }> {
  const copies = await importAll(sourceFiles);
  let createdClassId: number | null = null;
  let versionId: number | null = null;
  const fileIds: number[] = [];
  try {
    const classId =
      form.classChoice === "new"
        ? (createdClassId = await createClass(db, form.newClassName, form.newClassCategory as Category))
        : form.classChoice;
    versionId = await createVersion(db, {
      class_id: classId,
      issuing_authority: orNull(form.issuingAuthority),
      document_number: orNull(form.documentNumber),
      issue_date: valid.issueDate,
      expiry_date: valid.expiryDate,
      notes: orNull(form.notes),
    });
    for (const [i, copy] of copies.entries()) fileIds.push(await addFile(db, versionId, copy, i));
    return { classId, versionId };
  } catch (err) {
    for (const id of fileIds) await deleteFileRecord(db, id).catch(() => {});
    if (versionId !== null) await deleteVersion(db, versionId).catch(() => {});
    if (createdClassId !== null) await deleteEmptyClass(db, createdClassId).catch(() => {});
    await removeCopies(copies);
    throw err;
  }
}

export interface FileChanges {
  /** Stored files to delete (the UI asks for confirmation first). */
  remove: DocumentFile[];
  /** Files on disk to add after the remaining ones. */
  add: string[];
}

export const NO_FILE_CHANGES: FileChanges = { remove: [], add: [] };

/**
 * Saves edits to a version and its class. Removed files are only deleted from the app data
 * directory after the database is updated. Returns false when a removed file could not be
 * deleted (the edit itself did succeed).
 */
export async function updateDocument(
  db: Db,
  documentClass: DocumentClass,
  version: DocumentVersion,
  form: EditForm,
  valid: ValidDocument,
  changes: FileChanges,
): Promise<{ oldFilesRemoved: boolean }> {
  const copies = await importAll(changes.add);
  const addedIds: number[] = [];
  try {
    if (form.className.trim() !== documentClass.name || form.category !== documentClass.category) {
      await updateClass(db, documentClass.id, form.className, form.category);
    }
    await updateVersion(db, version.id, {
      issuing_authority: orNull(form.issuingAuthority),
      document_number: orNull(form.documentNumber),
      issue_date: valid.issueDate,
      expiry_date: valid.expiryDate,
      notes: orNull(form.notes),
    });
    const next = Math.max(-1, ...version.files.map((f) => f.position)) + 1;
    for (const [i, copy] of copies.entries()) addedIds.push(await addFile(db, version.id, copy, next + i));
    for (const f of changes.remove) await deleteFileRecord(db, f.id);
    if (valid.expiryDate !== version.expiry_date) await clearNotified(db, version.id);
  } catch (err) {
    for (const id of addedIds) await deleteFileRecord(db, id).catch(() => {});
    await removeCopies(copies);
    throw err;
  }
  return { oldFilesRemoved: await removeStored(changes.remove) };
}

/**
 * Deletes one version (after the user confirmed), then its files. With `deleteClass`, the class
 * goes too when this was its last version. Returns false when a file could not be removed.
 */
export async function deleteDocumentVersion(
  db: Db,
  version: DocumentVersion,
  deleteClass: boolean,
): Promise<{ fileRemoved: boolean }> {
  await deleteVersion(db, version.id);
  if (deleteClass) await deleteEmptyClass(db, version.class_id);
  return { fileRemoved: await removeStored(version.files) };
}
