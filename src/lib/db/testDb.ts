/// <reference types="node" />
/** Test-only: the real migration on an in-memory node:sqlite database, behind the same Db interface. */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Db } from "./types";

const MIGRATIONS = ["0001_init.sql"].map((name) =>
  readFileSync(new URL(`../../../src-tauri/migrations/${name}`, import.meta.url), "utf8"),
);

/** `$1` (sqlx) to `?1` (numbered SQLite parameter), so repeated parameters bind correctly. */
const toNumbered = (sql: string) => sql.replace(/\$(\d+)/g, "?$1");

export function createTestDb(): Db {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON"); // sqlx enables this by default in the app
  for (const sql of MIGRATIONS) sqlite.exec(sql);
  return {
    async execute(sql, params = []) {
      const r = sqlite.prepare(toNumbered(sql)).run(...(params as never[]));
      return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(toNumbered(sql)).all(...(params as never[])).map((row) => ({ ...row })) as T;
    },
  };
}
