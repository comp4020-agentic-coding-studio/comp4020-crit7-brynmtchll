// Reads the iCalendar file MyTimetable (Allocate+) exports, which lists every
// dated occurrence of every class a student is allocated to, and turns it
// back into the weekly timetable those dates came from.
//
// Each event's DESCRIPTION opens with Allocate+'s own identity for the class
// — "COMP4020_S2_1_9056\, TutA\, 04" — and that, not the free-text summary,
// is what the parser keys on. A weekly meeting is a (weekday, start, end)
// slot the class occupies at least twice; a slot seen once is a one-off
// (an in-class assessment, a make-up) and is skipped, not guessed at.

export type WeeklyMeeting = { day: number; start: number; end: number; room: string | null };

export type WeeklyClass = {
  courseCode: string;
  courseTitle: string;
  activity: string;
  group: string;
  meetings: WeeklyMeeting[];
};

export type ParsedTimetable = {
  classes: WeeklyClass[];
  // occurrences dropped as one-offs or weekend classes
  skipped: number;
};

const CLASS_ID = /^([A-Z]{4}\d{4})[^,]*,\s*([A-Za-z]+),\s*(\S+)/;

// RFC 5545: long lines are folded onto continuation lines that start with a
// space or tab, and text values escape commas, semicolons and newlines.
const unfold = (text: string): string[] =>
  text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");

const unescape = (value: string): string =>
  value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

type WallClock = { weekday: number; minutes: number };

// Allocate+ writes local times against a TZID (Australia/Melbourne, whose
// clock Canberra shares), so the wall-clock digits are already the answer.
// A UTC value ("...Z") is converted to Canberra time to reach the same place.
function wallClock(value: string): WallClock | undefined {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})\d{2}(Z?)$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, utc] = m;
  if (utc) {
    const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Canberra",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .map((p) => [p.type, p.value]),
    );
    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1;
    return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  }
  const weekday = new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay() || 7; // Sunday is 7
  return { weekday, minutes: Number(h) * 60 + Number(mi) };
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
  type Slot = WeeklyMeeting & { seen: number };
  const byClass = new Map<string, Omit<WeeklyClass, "meetings"> & { slots: Map<string, Slot> }>();
  let occurrences = 0;

  for (const event of events(text)) {
    const id = unescape(event.DESCRIPTION ?? "").split("\n")[0].match(CLASS_ID);
    const start = wallClock(event.DTSTART ?? "");
    const end = wallClock(event.DTEND ?? "");
    if (!id || !start || !end) continue;
    occurrences++;

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
    if (slot) slot.seen++;
    else
      entry.slots.set(slotKey, {
        day: start.weekday,
        start: start.minutes,
        end: end.minutes,
        room,
        seen: 1,
      });
  }

  const classes: WeeklyClass[] = [];
  let kept = 0;
  for (const { slots, ...rest } of byClass.values()) {
    const meetings = [...slots.values()]
      .filter((s) => s.seen >= 2 && s.day <= 5 && s.start < s.end)
      .sort((a, b) => a.day - b.day || a.start - b.start)
      .map(({ seen, ...meeting }) => {
        kept += seen;
        return meeting;
      });
    if (meetings.length > 0) classes.push({ ...rest, meetings });
  }
  classes.sort(
    (a, b) =>
      a.courseCode.localeCompare(b.courseCode) ||
      a.activity.localeCompare(b.activity) ||
      a.group.localeCompare(b.group),
  );
  return { classes, skipped: occurrences - kept };
}
