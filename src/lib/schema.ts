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

// The dates a meeting actually happens, straight from the export. A weekly
// slot doesn't run every week: the export leaves out the teaching break and
// public holidays (no COMP3320 lecture on Labour Day), and a one-off session
// is a meeting with a single date. A meeting with no dates at all was
// imported before dates were kept, and is read as running every week.
export const occurrences = sqliteTable(
  "occurrences",
  {
    meetingId: int("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    date: text().notNull(), // "2026-10-05", Canberra's calendar
  },
  (t) => [
    primaryKey({ columns: [t.meetingId, t.date] }),
    check("occurrences_iso_date", sql`${t.date} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

// --- people: the state users create -----------------------------------------

// No accounts. The share code is public (give it to a friend to be
// overlaid); who may act as a person is a session (below).
export const people = sqliteTable("people", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  shareCode: text("share_code").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// One per device holding a timetable: the device's cookie carries a secret
// token, and the database keeps only its hash. Several sessions per person
// is what lets a timetable imported on a laptop be checked on a phone, and
// what makes a lost cookie recoverable from another device.
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  personId: int("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// A one-time code that lets a second device join a timetable: made on a
// device that has it, claimed on one that doesn't, and short-lived, since
// whoever holds it can act as that person.
export const deviceLinks = sqliteTable("device_links", {
  codeHash: text("code_hash").primaryKey(),
  personId: int("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(), // ISO 8601, UTC
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
export type Session = typeof sessions.$inferSelect;
