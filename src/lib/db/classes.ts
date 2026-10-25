import type { Category, DocumentClass } from "../domain/types";
import type { Db } from "./types";

export function listClasses(db: Db): Promise<DocumentClass[]> {
  return db.select<DocumentClass[]>("SELECT * FROM document_class ORDER BY name COLLATE NOCASE");
}

/** Case-insensitive, matching the UNIQUE constraint on the name. */
export async function findClassByName(db: Db, name: string): Promise<DocumentClass | undefined> {
  const rows = await db.select<DocumentClass[]>("SELECT * FROM document_class WHERE name = $1 COLLATE NOCASE", [name.trim()]);
  return rows[0];
}

export async function createClass(db: Db, name: string, category: Category): Promise<number> {
  const result = await db.execute("INSERT INTO document_class (name, category) VALUES ($1, $2)", [name.trim(), category]);
  if (result.lastInsertId === undefined) throw new Error("No id returned for new document class");
  return result.lastInsertId;
}

export async function updateClass(db: Db, id: number, name: string, category: Category): Promise<void> {
  await db.execute("UPDATE document_class SET name = $1, category = $2 WHERE id = $3", [name.trim(), category, id]);
}

/** Only deletes a class without versions: after undoing a failed save, or when the user removed its last version. */
export async function deleteEmptyClass(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM document_class WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM document_version WHERE class_id = $1)", [id]);
}
