import Database from "@tauri-apps/plugin-sql";
import type { Db } from "./types";

/** Must match the URL the migrations are registered for in src-tauri/src/lib.rs. */
export const DB_URL = "sqlite:vaarpapieren.db";

let dbPromise: Promise<Db> | null = null;

/** The app database; migrations run on the first load. */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}
