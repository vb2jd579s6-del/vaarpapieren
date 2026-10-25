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

/** Only for undoing a class created moments ago whose first version could not be saved. */
export async function deleteEmptyClass(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM document_class WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM document_version WHERE class_id = $1)", [id]);
}
