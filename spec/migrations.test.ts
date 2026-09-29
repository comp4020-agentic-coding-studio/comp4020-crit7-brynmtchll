import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/lib/open-db";

// Migrations run at boot against the live volume, so the procedure that runs
// them is guarded here. A migration that recreates a table (copy, DROP,
// rename) is what drizzle-kit generates for changes SQLite can't ALTER in
// place, and with foreign keys on, the DROP cascades into every child row.

type Journal = { entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[] };

// A scratch copy of the real migrations, optionally stopping after one of
// them (to set up state as an older deploy left it), plus any extra ones.
function migrationsWith(extra: { tag: string; sql: string }[] = [], upTo?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "migrations-"));
  cpSync("./drizzle", dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal: Journal = JSON.parse(readFileSync(journalPath, "utf8"));
  if (upTo) journal.entries = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === upTo) + 1);
  for (const { tag, sql } of extra) {
    const last = journal.entries.at(-1);
    if (!last) throw new Error("empty journal");
    journal.entries.push({ ...last, idx: last.idx + 1, when: last.when + 1, tag });
    writeFileSync(join(dir, `${tag}.sql`), sql);
  }
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

// What drizzle-kit writes to recreate `meetings` (e.g. for a nullability
// change): note the PRAGMA lines, which do nothing inside a transaction.
const RECREATE_MEETINGS = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_meetings\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`class_id\` integer NOT NULL,
	\`person_id\` integer NOT NULL,
	\`day\` integer NOT NULL,
	\`start\` integer NOT NULL,
	\`end\` integer NOT NULL,
	\`room\` text,
	FOREIGN KEY (\`class_id\`) REFERENCES \`classes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`person_id\`) REFERENCES \`people\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO \`__new_meetings\` SELECT * FROM \`meetings\`;--> statement-breakpoint
DROP TABLE \`meetings\`;--> statement-breakpoint
ALTER TABLE \`__new_meetings\` RENAME TO \`meetings\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX \`meetings_person_class_slot\` ON \`meetings\` (\`person_id\`,\`class_id\`,\`day\`,\`start\`,\`end\`);`;

const rows = (client: { prepare: (sql: string) => { all: () => unknown[] } }, sql: string) => client.prepare(sql).all();

describe("migrating the live database", () => {
  it("keeps child rows through a migration that recreates their parent table", () => {
    const path = join(mkdtempSync(join(tmpdir(), "db-")), "app.db");
    const before = openDatabase(path, migrationsWith());
    before.client.exec(`
      insert into people (name, share_code) values ('Holder', 'HOLDER');
      insert into courses values ('COMP4020', 'Agentic Coding Studio');
      insert into classes (course_code, activity, "group") values ('COMP4020', 'TutA', '04');
      insert into meetings (class_id, person_id, day, start, end, room) values (1, 1, 3, 630, 720, null);
      insert into occurrences values (1, '2026-09-30'), (1, '2026-10-07');
    `);
    before.client.close();

    const after = openDatabase(path, migrationsWith([{ tag: "9999_recreate_meetings", sql: RECREATE_MEETINGS }]));
    const count = (table: string) =>
      (after.client.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;
    expect(count("meetings")).toBe(1);
    expect(count("occurrences")).toBe(2); // cascaded away if keys were on
    expect(after.client.pragma("foreign_keys", { simple: true })).toBe(1); // and back on afterwards
    after.client.close();
  });

  it("carries each device's token into sessions, so a deploy signs nobody out", () => {
    const path = join(mkdtempSync(join(tmpdir(), "db-")), "app.db");
    // the volume as the first deploys left it: the token hash on people
    const before = openDatabase(path, migrationsWith([], "0003_dated_occurrences"));
    before.client.exec(`insert into people (name, share_code, token_hash) values ('Early', 'EARLY2', 'hash-of-early')`);
    before.client.close();

    const after = openDatabase(path, migrationsWith());
    expect(after.client.prepare("select token_hash, person_id from sessions").all()).toEqual([
      { token_hash: "hash-of-early", person_id: 1 },
    ]);
    after.client.close();
  });

  it("gives each person their own copy of a shared meeting, dates and all", () => {
    const path = join(mkdtempSync(join(tmpdir(), "db-")), "app.db");
    // the volume as 0004 left it: one meeting row shared by everyone in the class
    const before = openDatabase(path, migrationsWith([], "0004_device_sessions"));
    before.client.exec(`
      insert into people (name, share_code) values ('Ada', 'ADA222'), ('Bo', 'BO3333');
      insert into courses values ('COMP4020', 'Agentic Coding Studio');
      insert into classes (course_code, activity, "group") values ('COMP4020', 'TutA', '04'), ('COMP4020', 'TutA', '05');
      insert into meetings (class_id, day, start, end, room) values (1, 3, 630, 720, 'Marie Reay 4.03'), (2, 3, 780, 870, null);
      insert into occurrences values (1, '2026-09-30'), (1, '2026-10-07'), (2, '2026-09-30');
      insert into picks values (1, 1), (2, 1);
    `);
    before.client.close();

    const after = openDatabase(path, migrationsWith());
    expect(
      rows(after.client, "select class_id, person_id, day, start, end, room from meetings order by person_id"),
    ).toEqual([
      { class_id: 1, person_id: 1, day: 3, start: 630, end: 720, room: "Marie Reay 4.03" },
      { class_id: 1, person_id: 2, day: 3, start: 630, end: 720, room: "Marie Reay 4.03" },
    ]); // TutA 05's meeting had nobody holding it, so it has nobody to belong to
    expect(
      rows(
        after.client,
        "select m.person_id, o.date from occurrences o join meetings m on m.id = o.meeting_id order by m.person_id, o.date",
      ),
    ).toEqual([
      { person_id: 1, date: "2026-09-30" },
      { person_id: 1, date: "2026-10-07" },
      { person_id: 2, date: "2026-09-30" },
      { person_id: 2, date: "2026-10-07" },
    ]);
    after.client.close();
  });
});
