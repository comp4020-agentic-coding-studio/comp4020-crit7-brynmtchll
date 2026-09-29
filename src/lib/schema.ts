import { sql } from "drizzle-orm";
import {
  check,
  int,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

// --- the catalogue: what ANU timetables, seeded by migration ---------------

export const courses = sqliteTable("courses", {
  code: text().primaryKey(), // "COMP4020"
  title: text().notNull(),
});

// One bookable group, the unit MyTimetable (Allocate+) allocates you to:
// "COMP4020 Tutorial 03". A student holds one group per course and kind.
export const CLASS_KINDS = ["Lecture", "Tutorial", "Lab", "Workshop"] as const;

export const classes = sqliteTable(
  "classes",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    kind: text({ enum: CLASS_KINDS }).notNull(),
    group: text().notNull(), // "01"
  },
  (t) => [uniqueIndex("classes_course_kind_group").on(t.courseCode, t.kind, t.group)],
);

// When a class meets. Its own table because one group can meet more than
// once a week (a lecture on Monday and Wednesday). Times are minutes after
// midnight, Canberra time, so overlap and free-time arithmetic is integer
// comparison rather than string parsing.
export const meetings = sqliteTable(
  "meetings",
  {
    id: int().primaryKey({ autoIncrement: true }),
    classId: int("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    day: int().notNull(), // 1 = Monday … 5 = Friday
    start: int().notNull(),
    end: int().notNull(),
    room: text().notNull(),
  },
  (t) => [
    check("meetings_weekday", sql`${t.day} between 1 and 5`),
    check("meetings_ordered", sql`${t.start} >= 0 and ${t.start} < ${t.end} and ${t.end} <= 1440`),
  ],
);

// --- people: the state users create -----------------------------------------

// No accounts. The share code is public (give it to a friend to be
// overlaid); the token is secret and lives only in the owner's cookie, so
// the database keeps just its hash.
export const people = sqliteTable("people", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  shareCode: text("share_code").notNull().unique(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// The classes a person has chosen. "One group per course and kind" is
// enforced where picks are written (src/lib/db.ts), which swaps the old
// group for the new one in a single transaction.
export const picks = sqliteTable(
  "picks",
  {
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    classId: int("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.personId, t.classId] })],
);

// One-way: knowing someone's share code is permission to overlay them.
export const follows = sqliteTable(
  "follows",
  {
    followerId: int("follower_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    followeeId: int("followee_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

export type Course = typeof courses.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Person = typeof people.$inferSelect;
