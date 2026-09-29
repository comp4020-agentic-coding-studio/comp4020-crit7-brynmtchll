// Builds calendar text in the shape MyTimetable (Allocate+) exports, so tests
// can describe a timetable in a few lines. The event layout — a TZID'd local
// DTSTART, and a DESCRIPTION opening "<offering>\, <activity>\, <group>" —
// is copied from a real export; see the verbatim excerpt in ical.test.ts.

export type Occurrence = {
  course: string; // "COMP4020"
  title: string;
  activity: string; // "TutA"
  group: string; // "04", "02-P1"
  date: string; // "20260930"
  start: string; // "1030"
  end: string; // "1200"
  location?: string;
};

const escape = (s: string): string => s.replace(/[\\,;]/g, (c) => `\\${c}`);

export function myTimetable(occurrences: Occurrence[]): string {
  const events = occurrences.map((o, i) => {
    const offering = `${o.course}_S2_1_0000`;
    const location = o.location ?? "NA";
    return [
      "BEGIN:VEVENT",
      "DTSTAMP:20260913T013234Z",
      `DTSTART;TZID=Australia/Melbourne:${o.date}T${o.start}00`,
      `DTEND;TZID=Australia/Melbourne:${o.date}T${o.end}00`,
      `SUMMARY:${escape(`${o.title} (Class: 0000), ${o.activity}`)}`,
      `LOCATION:${escape(location)}`,
      `DESCRIPTION:${escape(`${offering}, ${o.activity}, ${o.group}`)}\\n${escape(o.title)}\\nStaff: -\\nLocation: ${escape(location)}`,
      `UID:uid${i}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//Allocate//iCal4j 1.0//EN",
    "VERSION:2.0",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

// The same class on the same weekday, a week apart: what makes it weekly.
export function weekly(o: Omit<Occurrence, "date">, dates: string[]): Occurrence[] {
  return dates.map((date) => ({ ...o, date }));
}

// Two consecutive Mondays through Fridays of semester 2, 2026.
export const WEEKS = {
  mon: ["20260921", "20260928"],
  tue: ["20260922", "20260929"],
  wed: ["20260923", "20260930"],
  thu: ["20260924", "20261001"],
  fri: ["20260925", "20261002"],
};
