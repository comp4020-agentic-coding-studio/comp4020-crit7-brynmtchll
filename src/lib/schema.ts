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

// --- the catalogue: what ANU timetables -------------------------------------
//
// Nobody seeds this. It grows from the MyTimetable exports people import
// (src/lib/ical.ts), so two friends who both import "COMP4020 TutA 04" land
// on the same class row, and that shared row is what "you share a tute"
// means.

export const courses = sqliteTable("courses", {
  code: text().primaryKey(), // "COMP4020"
  title: text().notNull(),
});

// One bookable group, the unit MyTimetable (Allocate+) allocates you to. The
// activity is Allocate+'s own code, not a kind: a course can run LecA and
// LecB as separate activities, each with its own group 01, and a student
// holds one group per activity.
export const classes = sqliteTable(
  "classes",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    activity: text().notNull(), // "TutA"
    group: text().notNull(), // "04"
  },
  (t) => [uniqueIndex("classes_course_activity_group").on(t.courseCode, t.activity, t.group)],
);

// When a class meets. Its own table because one group can meet more than
// once a week, and because Allocate+ splits some groups into parts (a lab
// "02-P1" 13:00–14:30 then its drop-in "02-P2" 14:30–15:00), which are two
// meetings of one class. Times are minutes after midnight, Canberra time, so
// overlap and free-time arithmetic is integer comparison rather than string
// parsing. A null room is a class with no room (Allocate+ says "NA").
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
    room: text(),
  },
  (t) => [
    // re-importing a class someone else already brought in is a no-op
    uniqueIndex("meetings_class_slot").on(t.classId, t.day, t.start, t.end),
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

// The classes in a person's timetable. An import replaces them wholesale in
// one transaction (src/lib/timetable.ts): a MyTimetable export already holds
// exactly one group per activity, so the export is the source of truth and
// re-importing is how you pick up a changed allocation.
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
