import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { announce } from "./events";
import type { ParsedTimetable } from "./ical";
import { classes, courses, meetings, occurrences, type Person, picks } from "./schema";

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

// An import is the whole timetable: the person's picks and meetings are
// replaced, not merged, so re-importing after a MyTimetable change is how
// you update. Classes are shared, so a class someone else imported first is
// reused (that shared row is what makes a shared class); the meetings are
// this person's own, so no import can move anyone else's week.
export function importTimetable(me: Person, parsed: ParsedTimetable): void {
  db.transaction((tx) => {
    // occurrences go with their meetings (on delete cascade)
    tx.delete(meetings).where(eq(meetings.personId, me.id)).run();
    tx.delete(picks).where(eq(picks.personId, me.id)).run();
    for (const c of parsed.classes) {
      tx.insert(courses).values({ code: c.courseCode }).onConflictDoNothing().run();
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
      const inserted = tx
        .insert(meetings)
        .values(c.meetings.map(({ dates, ...m }) => ({ ...m, classId: row.id, personId: me.id })))
        .returning({ id: meetings.id })
        .all();
      const dated = c.meetings.flatMap((m, i) =>
        m.dates.map((date) => ({ meetingId: inserted[i].id, date })),
      );
      if (dated.length > 0) tx.insert(occurrences).values(dated).run();
      tx.insert(picks)
        .values({ personId: me.id, classId: row.id, courseTitle: c.courseTitle })
        .onConflictDoNothing()
        .run();
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
  // when it happens; empty for a meeting imported before dates were kept,
  // which is read as happening every week
  dates: string[];
};

// Every meeting of every class the given people hold, one row per (person,
// meeting), with its dates: the overlay's raw material.
export function slotsFor(personIds: number[]): Slot[] {
  if (personIds.length === 0) return [];
  const rows = db
    .select({
      personId: picks.personId,
      classId: classes.id,
      courseCode: courses.code,
      courseTitle: picks.courseTitle,
      activity: classes.activity,
      group: classes.group,
      day: meetings.day,
      start: meetings.start,
      end: meetings.end,
      room: meetings.room,
      dates: sql<string | null>`group_concat(${occurrences.date})`,
    })
    .from(picks)
    .innerJoin(classes, eq(classes.id, picks.classId))
    .innerJoin(courses, eq(courses.code, classes.courseCode))
    // their own meetings of the class, as their export has it
    .innerJoin(meetings, and(eq(meetings.classId, classes.id), eq(meetings.personId, picks.personId)))
    .leftJoin(occurrences, eq(occurrences.meetingId, meetings.id))
    .where(inArray(picks.personId, personIds))
    .groupBy(picks.personId, meetings.id)
    .orderBy(asc(meetings.day), asc(meetings.start), asc(courses.code))
    .all();
  return rows.map((r) => ({ ...r, dates: r.dates ? r.dates.split(",").sort() : [] }));
}

// A meeting with one date is a one-off session; anything else (including
// the dateless, pre-dates meetings) recurs.
export const isOneOff = (s: Slot): boolean => s.dates.length === 1;

export function occursOn(s: Slot, date: string): boolean {
  return s.dates.length === 0 || s.dates.includes(date);
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
