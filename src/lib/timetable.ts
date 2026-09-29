import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { announce } from "./events";
import type { ParsedTimetable } from "./ical";
import { classes, courses, meetings, type Person, picks } from "./schema";

// Allocate+ activity codes are a kind prefix plus a letter ("LecA", "TutA",
// "ComB"); the prefix is what a person reads.
const KINDS: Record<string, string> = {
  Lec: "Lecture",
  Tut: "Tutorial",
  Com: "Computer lab",
  Lab: "Lab",
  Wrk: "Workshop",
  Wks: "Workshop",
  Sem: "Seminar",
  Pra: "Practical",
  Stu: "Studio",
  Dro: "Drop-in",
  Asm: "Assessment",
};

export function activityLabel(activity: string): string {
  return KINDS[activity.slice(0, 3)] ?? activity;
}

// An import is the whole timetable: the person's picks are replaced, not
// merged, so re-importing after a MyTimetable change is how you update. The
// catalogue rows are shared, so a class someone else imported first is
// reused (that shared row is what makes a shared class), and its meetings
// are refreshed from the newest export, which is the best information
// anyone has about when it meets.
export function importTimetable(me: Person, parsed: ParsedTimetable): void {
  db.transaction((tx) => {
    tx.delete(picks).where(eq(picks.personId, me.id)).run();
    for (const c of parsed.classes) {
      tx.insert(courses)
        .values({ code: c.courseCode, title: c.courseTitle })
        .onConflictDoNothing()
        .run();
      tx.insert(classes)
        .values({ courseCode: c.courseCode, activity: c.activity, group: c.group })
        .onConflictDoNothing()
        .run();
      const row = tx
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(
            eq(classes.courseCode, c.courseCode),
            eq(classes.activity, c.activity),
            eq(classes.group, c.group),
          ),
        )
        .get();
      if (!row) throw new Error(`class ${c.courseCode} ${c.activity} ${c.group} vanished`);
      tx.delete(meetings).where(eq(meetings.classId, row.id)).run();
      tx.insert(meetings)
        .values(c.meetings.map((m) => ({ ...m, classId: row.id })))
        .run();
      tx.insert(picks).values({ personId: me.id, classId: row.id }).onConflictDoNothing().run();
    }
  });
  announce({ personId: me.id });
}

export type Slot = {
  personId: number;
  classId: number;
  courseCode: string;
  courseTitle: string;
  activity: string;
  group: string;
  day: number;
  start: number;
  end: number;
  room: string | null;
};

// Every weekly meeting of every class the given people hold, one row per
// (person, meeting): the overlay's raw material.
export function slotsFor(personIds: number[]): Slot[] {
  if (personIds.length === 0) return [];
  return db
    .select({
      personId: picks.personId,
      classId: classes.id,
      courseCode: courses.code,
      courseTitle: courses.title,
      activity: classes.activity,
      group: classes.group,
      day: meetings.day,
      start: meetings.start,
      end: meetings.end,
      room: meetings.room,
    })
    .from(picks)
    .innerJoin(classes, eq(classes.id, picks.classId))
    .innerJoin(courses, eq(courses.code, classes.courseCode))
    .innerJoin(meetings, eq(meetings.classId, classes.id))
    .where(inArray(picks.personId, personIds))
    .orderBy(asc(meetings.day), asc(meetings.start), asc(courses.code))
    .all();
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
