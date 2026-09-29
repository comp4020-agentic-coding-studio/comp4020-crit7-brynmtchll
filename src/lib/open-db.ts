import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// Opens the SQLite file and brings its schema up to date. Split from db.ts
// so the migration procedure can be tested against a scratch file.
export function openDatabase(path: string, migrationsFolder = "./drizzle") {
  mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);
  client.pragma("journal_mode = WAL");

  // Foreign keys stay OFF while migrating. Some schema changes make
  // drizzle-kit recreate a table (copy, DROP, rename), and its generated
  // `PRAGMA foreign_keys=OFF` does nothing inside the migrator's
  // transaction. With keys on, dropping `people` cascades and deletes every
  // pick and follow. That was tried on a scratch copy, and it did. So keys
  // go off outside the transaction, the result is checked, then they go on.
  client.pragma("foreign_keys = OFF");
  const db = drizzle(client);
  migrate(db, { migrationsFolder });
  const broken = client.pragma("foreign_key_check") as unknown[];
  if (broken.length > 0) {
    throw new Error(`migrations left ${broken.length} broken foreign keys: ${JSON.stringify(broken)}`);
  }
  // The schema leans on its foreign keys (a pick must name a real class, a
  // deleted person takes their picks and follows with them), and SQLite only
  // enforces them when asked, per connection.
  client.pragma("foreign_keys = ON");

  return { client, db };
}
