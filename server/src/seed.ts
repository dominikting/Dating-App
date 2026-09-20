import { fileURLToPath } from "node:url";
import { db, initSchema } from "./db.js";

interface SeedUser {
  name: string;
  age: number;
  bio: string;
  location: string;
  hue: number;
  is_self?: boolean;
  /** If true, this profile has already liked the current user (id 1). */
  likesYou?: boolean;
}

const SEED_USERS: SeedUser[] = [
  { name: "You", age: 28, bio: "Just here to test the vibes.", location: "Berlin", hue: 265, is_self: true },
  { name: "Amelia", age: 27, bio: "Coffee snob, mountain hiker, and dog person.", location: "Berlin", hue: 340, likesYou: true },
  { name: "Noah", age: 30, bio: "Jazz records, ramen, and long bike rides.", location: "Berlin", hue: 205, likesYou: true },
  { name: "Sofia", age: 25, bio: "Painter by night, product designer by day.", location: "Munich", hue: 20 },
  { name: "Liam", age: 32, bio: "Rock climbing, bad puns, great tacos.", location: "Berlin", hue: 150, likesYou: true },
  { name: "Mia", age: 29, bio: "Bookworm looking for a plus-one to museums.", location: "Hamburg", hue: 290 },
  { name: "Ethan", age: 26, bio: "Runner, home cook, aspiring plant parent.", location: "Berlin", hue: 95 },
  { name: "Olivia", age: 31, bio: "Traveler with 24 countries and counting.", location: "Cologne", hue: 45 },
];

export function seed(): void {
  initSchema();

  db.exec("DELETE FROM messages; DELETE FROM swipes; DELETE FROM users;");
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users','swipes','messages');");

  const insertUser = db.prepare(
    "INSERT INTO users (name, age, bio, location, hue, is_self) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertSwipe = db.prepare(
    "INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, 'like')"
  );

  const insertMany = db.transaction((users: SeedUser[]) => {
    users.forEach((u) => {
      const info = insertUser.run(u.name, u.age, u.bio, u.location, u.hue, u.is_self ? 1 : 0);
      if (u.likesYou) {
        // Current user is always id 1 (the self profile, inserted first).
        insertSwipe.run(Number(info.lastInsertRowid), 1);
      }
    });
  });

  insertMany(SEED_USERS);
}

// Only run automatically when executed directly (npm run seed), not when imported.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  seed();
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  console.log(`Seeded ${count} users (current user = id 1 "You").`);
}
