import type { SeaService } from "../domain/seaTime";
import type { Db } from "./types";

export type SeaServiceInput = Omit<SeaService, "id" | "created_at" | "updated_at">;

export function listSeaService(db: Db): Promise<SeaService[]> {
  return db.select<SeaService[]>("SELECT * FROM sea_service ORDER BY sign_on DESC, id DESC");
}

export async function addSeaService(db: Db, s: SeaServiceInput): Promise<number> {
  const r = await db.execute(
    "INSERT INTO sea_service (vessel_name, vessel_type, imo_number, rank, sign_on, sign_off, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [s.vessel_name.trim(), s.vessel_type, s.imo_number, s.rank, s.sign_on, s.sign_off, s.notes],
  );
  if (r.lastInsertId === undefined) throw new Error("No id returned for new sea service");
  return r.lastInsertId;
}

export async function updateSeaService(db: Db, id: number, s: SeaServiceInput): Promise<void> {
  await db.execute(
    `UPDATE sea_service SET vessel_name = $1, vessel_type = $2, imo_number = $3, rank = $4, sign_on = $5, sign_off = $6, notes = $7,
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = $8`,
    [s.vessel_name.trim(), s.vessel_type, s.imo_number, s.rank, s.sign_on, s.sign_off, s.notes, id],
  );
}

/** Only after the user confirmed. */
export async function deleteSeaService(db: Db, id: number): Promise<void> {
  await db.execute("DELETE FROM sea_service WHERE id = $1", [id]);
}
