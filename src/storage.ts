import * as SQLite from "expo-sqlite";
import { Data, emptyData, validateData } from "./domain";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
async function db() {
  if (!database)
    database = (async () => {
      const result = await SQLite.openDatabaseAsync("shiftproof.db");
      await result.execAsync(
        "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL); PRAGMA user_version = 1;",
      );
      return result;
    })();
  return database;
}
export async function readData(): Promise<Data> {
  const row = await (
    await db()
  ).getFirstAsync<{ payload: string }>(
    "SELECT payload FROM app_state WHERE id = 1",
  );
  return row ? validateData(JSON.parse(row.payload)) : emptyData;
}
export async function writeData(data: Data) {
  validateData(data);
  await (
    await db()
  ).runAsync(
    "INSERT INTO app_state (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    JSON.stringify(data),
  );
}
