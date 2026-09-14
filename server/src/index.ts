import express from "express";
import cors from "cors";
import { db, initSchema, matchKey } from "./db.js";
import { seed } from "./seed.js";

const PORT = Number(process.env.PORT ?? 3001);
const CURRENT_USER_ID = 1; // Single-session demo: "You" is always user 1.

initSchema();

// Auto-seed on first boot so the app is usable immediately.
const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
if (userCount === 0) {
  seed();
  console.log("Database was empty — seeded demo profiles.");
}

interface UserRow {
  id: number;
  name: string;
  age: number;
  bio: string;
  location: string;
  hue: number;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/api/me", (_req, res) => {
  const me = db
    .prepare("SELECT id, name, age, bio, location, hue FROM users WHERE id = ?")
    .get(CURRENT_USER_ID) as UserRow | undefined;
  if (!me) return res.status(404).json({ error: "current user not found" });
  res.json(me);
});

// Candidates: everyone except me that I have not swiped on yet.
app.get("/api/candidates", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, age, bio, location, hue
       FROM users
       WHERE id != @me
         AND is_self = 0
         AND id NOT IN (SELECT target_id FROM swipes WHERE swiper_id = @me)
       ORDER BY id`
    )
    .all({ me: CURRENT_USER_ID }) as UserRow[];
  res.json(rows);
});

// Record a swipe. A mutual like produces a match.
app.post("/api/swipe", (req, res) => {
  const targetId = Number(req.body?.targetId);
  const direction = req.body?.direction;

  if (!Number.isInteger(targetId) || (direction !== "like" && direction !== "pass")) {
    return res.status(400).json({ error: "targetId (int) and direction ('like'|'pass') required" });
  }
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId) as { id: number } | undefined;
  if (!target) return res.status(404).json({ error: "target user not found" });

  db.prepare(
    `INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)
     ON CONFLICT (swiper_id, target_id) DO UPDATE SET direction = excluded.direction`
  ).run(CURRENT_USER_ID, targetId, direction);

  let match = false;
  let matchedUser: UserRow | null = null;
  if (direction === "like") {
    const reciprocal = db
      .prepare("SELECT id FROM swipes WHERE swiper_id = ? AND target_id = ? AND direction = 'like'")
      .get(targetId, CURRENT_USER_ID);
    if (reciprocal) {
      match = true;
      matchedUser = db
        .prepare("SELECT id, name, age, bio, location, hue FROM users WHERE id = ?")
        .get(targetId) as UserRow;
    }
  }

  res.json({ match, matchedUser });
});

// All mutual likes for the current user, most recent first.
app.get("/api/matches", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.age, u.bio, u.location, u.hue
       FROM swipes mine
       JOIN swipes theirs
         ON theirs.swiper_id = mine.target_id
        AND theirs.target_id = mine.swiper_id
        AND theirs.direction = 'like'
       JOIN users u ON u.id = mine.target_id
       WHERE mine.swiper_id = @me AND mine.direction = 'like'
       ORDER BY mine.created_at DESC, u.id`
    )
    .all({ me: CURRENT_USER_ID }) as UserRow[];

  const withPreview = rows.map((u) => {
    const last = db
      .prepare(
        "SELECT body, sender_id, created_at FROM messages WHERE match_key = ? ORDER BY id DESC LIMIT 1"
      )
      .get(matchKey(CURRENT_USER_ID, u.id)) as
      | { body: string; sender_id: number; created_at: string }
      | undefined;
    return { ...u, lastMessage: last ?? null };
  });

  res.json(withPreview);
});

function isMatched(otherId: number): boolean {
  const mine = db
    .prepare("SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND direction = 'like'")
    .get(CURRENT_USER_ID, otherId);
  const theirs = db
    .prepare("SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND direction = 'like'")
    .get(otherId, CURRENT_USER_ID);
  return Boolean(mine && theirs);
}

app.get("/api/matches/:userId/messages", (req, res) => {
  const otherId = Number(req.params.userId);
  if (!isMatched(otherId)) return res.status(403).json({ error: "not matched with this user" });
  const rows = db
    .prepare("SELECT id, sender_id, body, created_at FROM messages WHERE match_key = ? ORDER BY id ASC")
    .all(matchKey(CURRENT_USER_ID, otherId));
  res.json(rows);
});

app.post("/api/matches/:userId/messages", (req, res) => {
  const otherId = Number(req.params.userId);
  const body = String(req.body?.body ?? "").trim();
  if (!isMatched(otherId)) return res.status(403).json({ error: "not matched with this user" });
  if (!body) return res.status(400).json({ error: "message body required" });

  const info = db
    .prepare("INSERT INTO messages (match_key, sender_id, body) VALUES (?, ?, ?)")
    .run(matchKey(CURRENT_USER_ID, otherId), CURRENT_USER_ID, body);
  const msg = db
    .prepare("SELECT id, sender_id, body, created_at FROM messages WHERE id = ?")
    .get(Number(info.lastInsertRowid));
  res.status(201).json(msg);
});

app.listen(PORT, () => {
  console.log(`Dating App API listening on http://localhost:${PORT}`);
});
