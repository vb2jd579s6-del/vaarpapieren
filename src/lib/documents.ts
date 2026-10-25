import { createClass, deleteEmptyClass, updateClass } from "./db/classes";
import type { Db } from "./db/types";
import { createVersion, deleteVersion, updateVersion } from "./db/versions";
import type { DocumentForm, EditForm, ValidDocument } from "./domain/documentForm";
import type { Category, DocumentClass, DocumentVersion } from "./domain/types";
import { importDocumentFile, removeDocumentFile, type ImportedFile } from "./files";

const orNull = (s: string) => (s.trim() === "" ? null : s.trim());

/**
 * Saves a new version (and a new class when chosen). Steps run in order: copy the file, create
 * the class, insert the version. If a later step fails, what this call created is undone, so a
 * failed save leaves no stray file or empty class behind.
 */
export async function saveNewDocument(
  db: Db,
  form: DocumentForm,
  valid: ValidDocument,
  sourceFile: string | null,
): Promise<{ classId: number; versionId: number }> {
  const file: ImportedFile | null = sourceFile ? await importDocumentFile(sourceFile) : null;
  let createdClassId: number | null = null;
  try {
    let classId: number;
    if (form.classChoice === "new") {
      classId = createdClassId = await createClass(db, form.newClassName, form.newClassCategory as Category);
    } else {
      classId = form.classChoice;
    }
    const versionId = await createVersion(db, {
      class_id: classId,
      issuing_authority: orNull(form.issuingAuthority),
      document_number: orNull(form.documentNumber),
      issue_date: valid.issueDate,
      expiry_date: valid.expiryDate,
      file_path: file?.file_path ?? null,
      original_filename: file?.original_filename ?? null,
      notes: orNull(form.notes),
    });
    return { classId, versionId };
  } catch (err) {
    if (createdClassId !== null) await deleteEmptyClass(db, createdClassId).catch(() => {});
    if (file) await removeDocumentFile(file.file_path).catch(() => {});
    throw err;
  }
}

export type FileChange = { kind: "keep" } | { kind: "replace"; source: string } | { kind: "remove" };

/**
 * Saves edits to a version and its class. A replaced or removed file is only deleted from the
 * app data directory after the database is updated; the UI asks for confirmation first.
 * Returns false when the old file could not be removed (the edit itself did succeed).
 */
export async function updateDocument(
  db: Db,
  documentClass: DocumentClass,
  version: DocumentVersion,
  form: EditForm,
  valid: ValidDocument,
  fileChange: FileChange,
): Promise<{ oldFileRemoved: boolean }> {
  const newFile = fileChange.kind === "replace" ? await importDocumentFile(fileChange.source) : null;
  try {
    if (form.className.trim() !== documentClass.name || form.category !== documentClass.category) {
      await updateClass(db, documentClass.id, form.className, form.category);
    }
    const file =
      fileChange.kind === "keep"
        ? { file_path: version.file_path, original_filename: version.original_filename }
        : { file_path: newFile?.file_path ?? null, original_filename: newFile?.original_filename ?? null };
    await updateVersion(db, version.id, {
      issuing_authority: orNull(form.issuingAuthority),
      document_number: orNull(form.documentNumber),
      issue_date: valid.issueDate,
      expiry_date: valid.expiryDate,
      notes: orNull(form.notes),
      ...file,
    });
  } catch (err) {
    if (newFile) await removeDocumentFile(newFile.file_path).catch(() => {});
    throw err;
  }
  if (fileChange.kind === "keep" || !version.file_path) return { oldFileRemoved: true };
  return { oldFileRemoved: await removeDocumentFile(version.file_path).then(() => true, () => false) };
}

/**
 * Deletes one version (after the user confirmed), then its file. With `deleteClass`, the class
 * goes too when this was its last version. Returns false when the file could not be removed.
 */
export async function deleteDocumentVersion(
  db: Db,
  version: DocumentVersion,
  deleteClass: boolean,
): Promise<{ fileRemoved: boolean }> {
  await deleteVersion(db, version.id);
  if (deleteClass) await deleteEmptyClass(db, version.class_id);
  if (!version.file_path) return { fileRemoved: true };
  return { fileRemoved: await removeDocumentFile(version.file_path).then(() => true, () => false) };
}
