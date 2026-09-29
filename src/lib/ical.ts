import { canberraNow, weekdayOf } from "./dates";

// Reads the iCalendar file MyTimetable (Allocate+) exports, which lists every
// dated occurrence of every class a student is allocated to, and turns it
// into classes, their meetings, and the dates each meeting happens.
//
// Each event's DESCRIPTION opens with Allocate+'s own identity for the class
// — "COMP4020_S2_1_9056\, TutA\, 04" — and that, not the free-text summary,
// is what the parser keys on. A meeting is a (weekday, start, end) slot the
// class occupies; its dates are kept, since the export already knows which
// weeks a slot doesn't run (the teaching break, public holidays). A slot
// with a single date is a one-off session, such as an in-class assessment.

export type ParsedMeeting = {
  day: number;
  start: number;
  end: number;
  room: string | null;
  dates: string[]; // sorted, "YYYY-MM-DD"
};

export type ParsedClass = {
  courseCode: string;
  courseTitle: string;
  activity: string;
  group: string;
  meetings: ParsedMeeting[];
};

export type ParsedTimetable = {
  classes: ParsedClass[];
  // occurrences dropped because they fall on a weekend
  skipped: number;
};

const CLASS_ID = /^([A-Z]{4}\d{4})[^,]*,\s*([A-Za-z]+),\s*(\S+)/;

// RFC 5545: long lines are folded onto continuation lines that start with a
// space or tab, and text values escape commas, semicolons and newlines.
const unfold = (text: string): string[] =>
  text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");

const unescape = (value: string): string =>
  value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

type WallClock = { date: string; weekday: number; minutes: number };

// Allocate+ writes local times against a TZID (Australia/Melbourne, whose
// clock Canberra shares), so the wall-clock digits are already the answer.
// A UTC value ("...Z") is converted to Canberra time to reach the same place.
function wallClock(value: string): WallClock | undefined {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}(Z?)$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, utc] = m;
  if (utc) {
    const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    const { date, day, minutes } = canberraNow(instant);
    return { date, weekday: day, minutes };
  }
  const date = `${y}-${mo}-${d}`;
  return { date, weekday: weekdayOf(date), minutes: Number(h) * 60 + Number(mi) };
}

type RawEvent = Record<string, string>;

function events(text: string): RawEvent[] {
  const found: RawEvent[] = [];
  let current: RawEvent | undefined;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT") {
      if (current) found.push(current);
      current = undefined;
    } else if (current) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(";")[0].toUpperCase();
      current[name] = line.slice(colon + 1);
    }
  }
  return found;
}

export function parseMyTimetable(text: string): ParsedTimetable {
  type Slot = Omit<ParsedMeeting, "dates"> & { dates: Set<string> };
  const byClass = new Map<string, Omit<ParsedClass, "meetings"> & { slots: Map<string, Slot> }>();
  let skipped = 0;

  for (const event of events(text)) {
    const id = unescape(event.DESCRIPTION ?? "").split("\n")[0].match(CLASS_ID);
    const start = wallClock(event.DTSTART ?? "");
    const end = wallClock(event.DTEND ?? "");
    if (!id || !start || !end || start.minutes >= end.minutes) continue;
    if (start.weekday > 5) {
      skipped++;
      continue;
    }

    const [, courseCode, activity, rawGroup] = id;
    // "02-P1" and "02-P2" are two parts of group 02
    const group = rawGroup.replace(/-P\d+$/, "");
    const key = `${courseCode} ${activity} ${group}`;

    let entry = byClass.get(key);
    if (!entry) {
      const summary = unescape(event.SUMMARY ?? "");
      const courseTitle = summary.split(" (Class:")[0].trim() || courseCode;
      entry = { courseCode, courseTitle, activity, group, slots: new Map() };
      byClass.set(key, entry);
    }

    const location = unescape(event.LOCATION ?? "").trim();
    const room = location && location !== "NA" ? location : null;
    const slotKey = `${start.weekday} ${start.minutes} ${end.minutes}`;
    const slot = entry.slots.get(slotKey);
    if (slot) slot.dates.add(start.date);
    else
      entry.slots.set(slotKey, {
        day: start.weekday,
        start: start.minutes,
        end: end.minutes,
        room,
        dates: new Set([start.date]),
      });
  }

  const classes: ParsedClass[] = [];
  for (const { slots, ...rest } of byClass.values()) {
    const meetings = [...slots.values()]
      .sort((a, b) => a.day - b.day || a.start - b.start)
      .map(({ dates, ...meeting }) => ({ ...meeting, dates: [...dates].sort() }));
    classes.push({ ...rest, meetings });
  }
  classes.sort(
    (a, b) =>
      a.courseCode.localeCompare(b.courseCode) ||
      a.activity.localeCompare(b.activity) ||
      a.group.localeCompare(b.group),
  );
  return { classes, skipped };
}
