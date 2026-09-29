import { describe, expect, it } from "vitest";
import { parseMyTimetable } from "../src/lib/ical";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";

// The import reads a real MyTimetable export back into a weekly timetable.
// These pin the export's quirks, each first seen in a real file: labs split
// into parts, a course running LecA and LecB as separate activities, one-off
// assessment sessions, and classes with no room.

// Verbatim from a real export (COMP4020's classes only), escapes and all.
const REAL_EXCERPT = `BEGIN:VCALENDAR
PRODID:-//Allocate//iCal4j 1.0//EN
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTAMP:20260913T013234Z
DTSTART;TZID=Australia/Melbourne:20260924T110000
DTEND;TZID=Australia/Melbourne:20260924T130000
SUMMARY:Advanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\, LecA
LOCATION:NA
DESCRIPTION:COMP4020_S2_1_9056\\, LecA\\, 01_Clone\\nAdvanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\nStaff: Ben Swift\\nLocation: NA
UID:uid99
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20260913T013234Z
DTSTART;TZID=Australia/Melbourne:20261001T110000
DTEND;TZID=Australia/Melbourne:20261001T130000
SUMMARY:Advanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\, LecA
LOCATION:NA
DESCRIPTION:COMP4020_S2_1_9056\\, LecA\\, 01_Clone\\nAdvanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\nStaff: Ben Swift\\nLocation: NA
UID:uid100
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20260913T013234Z
DTSTART;TZID=Australia/Melbourne:20260923T103000
DTEND;TZID=Australia/Melbourne:20260923T120000
SUMMARY:Advanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\, TutA
LOCATION:Rm 4.03_Marie Reay Bldg 155
DESCRIPTION:COMP4020_S2_1_9056\\, TutA\\, 04\\nAdvanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\nStaff: -\\nLocation: Rm 4.03_Marie Reay Bldg 155
UID:uid110
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20260913T013234Z
DTSTART;TZID=Australia/Melbourne:20260930T103000
DTEND;TZID=Australia/Melbourne:20260930T120000
SUMMARY:Advanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\, TutA
LOCATION:Rm 4.03_Marie Reay Bldg 155
DESCRIPTION:COMP4020_S2_1_9056\\, TutA\\, 04\\nAdvanced Topics in Human-Centr_Agentic Coding Studio (Class: 9056)\\nStaff: -\\nLocation: Rm 4.03_Marie Reay Bldg 155
UID:uid111
END:VEVENT
END:VCALENDAR
`;

const COURSE = { course: "TEST1001", title: "Test Course" };

describe("parseMyTimetable", () => {
  it("reads a real export into weekly classes", () => {
    const { classes, skipped } = parseMyTimetable(REAL_EXCERPT);
    expect(skipped).toBe(0);
    expect(classes).toEqual([
      {
        courseCode: "COMP4020",
        courseTitle: "Advanced Topics in Human-Centr_Agentic Coding Studio",
        activity: "LecA",
        group: "01_Clone",
        meetings: [{ day: 4, start: 11 * 60, end: 13 * 60, room: null }],
      },
      {
        courseCode: "COMP4020",
        courseTitle: "Advanced Topics in Human-Centr_Agentic Coding Studio",
        activity: "TutA",
        group: "04",
        meetings: [{ day: 3, start: 10 * 60 + 30, end: 12 * 60, room: "Rm 4.03_Marie Reay Bldg 155" }],
      },
    ]);
  });

  it("joins a lab's parts into one class with two meetings", () => {
    const lab = { ...COURSE, activity: "ComA", location: "Rms N115/N116_Skaidrite Darius Bldg 108" };
    const { classes } = parseMyTimetable(
      myTimetable([
        ...weekly({ ...lab, group: "02-P1", start: "1300", end: "1430" }, WEEKS.wed),
        ...weekly({ ...lab, group: "02-P2", start: "1430", end: "1500" }, WEEKS.wed),
      ]),
    );
    expect(classes).toHaveLength(1);
    expect(classes[0].group).toBe("02");
    expect(classes[0].meetings.map((m) => [m.start, m.end])).toEqual([
      [13 * 60, 14 * 60 + 30],
      [14 * 60 + 30, 15 * 60],
    ]);
  });

  it("keeps LecA and LecB as separate classes though both are group 01", () => {
    const { classes } = parseMyTimetable(
      myTimetable([
        ...weekly({ ...COURSE, activity: "LecA", group: "01", start: "0900", end: "1000" }, WEEKS.mon),
        ...weekly({ ...COURSE, activity: "LecB", group: "01", start: "0900", end: "1100" }, WEEKS.fri),
      ]),
    );
    expect(classes.map((c) => `${c.activity} ${c.group}`)).toEqual(["LecA 01", "LecB 01"]);
  });

  it("skips a session that happens once, rather than calling it weekly", () => {
    const { classes, skipped } = parseMyTimetable(
      myTimetable([
        ...weekly({ ...COURSE, activity: "LecA", group: "01", start: "0900", end: "1000" }, WEEKS.mon),
        { ...COURSE, activity: "AsmA", group: "01", date: "20260828", start: "0900", end: "1100" },
      ]),
    );
    expect(classes.map((c) => c.activity)).toEqual(["LecA"]);
    expect(skipped).toBe(1);
  });

  it("reads folded lines and CRLF line endings", () => {
    const folded = myTimetable(
      weekly({ ...COURSE, activity: "TutA", group: "03", start: "1400", end: "1500" }, WEEKS.tue),
    ).replace(/DESCRIPTION:TEST1001/g, "DESCRIPTION:TEST\r\n 1001");
    expect(parseMyTimetable(folded).classes.map((c) => c.courseCode)).toEqual(["TEST1001"]);
  });

  it("finds nothing in text that isn't an export", () => {
    expect(parseMyTimetable("hello").classes).toEqual([]);
  });
});
