import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(__dirname, "..", "data.sqlite");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT NOT NULL,
      age      INTEGER NOT NULL,
      bio      TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      hue      INTEGER NOT NULL DEFAULT 210,
      is_self  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS swipes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      swiper_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (swiper_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      match_key  TEXT NOT NULL,
      sender_id  INTEGER NOT NULL,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function matchKey(a: number, b: number): string {
  return [a, b].sort((x, y) => x - y).join("-");
}
