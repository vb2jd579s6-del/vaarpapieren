import { createClass, deleteEmptyClass } from "./db/classes";
import type { Db } from "./db/types";
import { createVersion } from "./db/versions";
import type { DocumentForm, ValidDocument } from "./domain/documentForm";
import type { Category } from "./domain/types";
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
