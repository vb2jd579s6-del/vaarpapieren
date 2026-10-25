/** The part of `@tauri-apps/plugin-sql`'s Database the repositories use, so tests can swap in another SQLite. */
export interface Db {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}
