import { describe, expect, it } from "vitest";
import { canberraNow } from "../src/lib/dates";
import { inWeek, statusAt } from "../src/lib/overlay";
import type { Slot } from "../src/lib/timetable";

// "Right now" and "this week" on the overlay go by the dates classes actually
// run, taken from the export: a public holiday or the teaching break is not a
// normal day, and the time is always Canberra's.

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const slot = (day: number, start: string, end: string, courseCode: string, dates: string[]): Slot => ({
  personId: 1, classId: 1, courseCode, courseTitle: "", activity: "LecA", group: "01",
  day, start: minutes(start), end: minutes(end), room: null, dates,
});

// Wednesdays: a tute, then a lab after a lunch gap
const WEDS = ["2026-09-23", "2026-09-30", "2026-10-07"];
const wednesday = [
  slot(3, "10:30", "12:00", "COMP4020", WEDS),
  slot(3, "13:00", "14:30", "COMP3320", WEDS),
];
// a Monday lecture with no 5 October: Labour Day, as the real export has it
const monday = slot(1, "09:00", "10:00", "COMP3320", ["2026-09-28", "2026-10-12", "2026-10-19"]);
// a Thursday class imported before dates were kept
const dateless = slot(4, "09:00", "11:00", "COMP4691", []);

const at = (date: string, day: number, time: string) => ({ date, day, minutes: minutes(time) });

describe("statusAt", () => {
  it("is in class from the start of a class up to (not including) its end", () => {
    expect(statusAt(wednesday, 1, at("2026-09-30", 3, "10:30"))).toMatchObject({ state: "in-class", slot: { courseCode: "COMP4020" } });
    expect(statusAt(wednesday, 1, at("2026-09-30", 3, "11:59"))).toMatchObject({ state: "in-class" });
    expect(statusAt(wednesday, 1, at("2026-09-30", 3, "12:00"))).toMatchObject({ state: "free", next: { courseCode: "COMP3320" } });
  });

  it("names the next class when free before or between classes", () => {
    expect(statusAt(wednesday, 1, at("2026-09-30", 3, "08:00"))).toMatchObject({ state: "free", next: { courseCode: "COMP4020" } });
  });

  it("tells a finished day from a day with no classes", () => {
    expect(statusAt(wednesday, 1, at("2026-09-30", 3, "15:00"))).toEqual({ state: "done" });
    expect(statusAt(wednesday, 1, at("2026-10-01", 4, "11:00"))).toEqual({ state: "none" });
    expect(statusAt(wednesday, 2, at("2026-09-30", 3, "11:00"))).toEqual({ state: "none" }); // someone else's
  });

  it("knows the usual Monday lecture isn't on on Labour Day", () => {
    expect(statusAt([monday], 1, at("2026-10-05", 1, "09:30"))).toEqual({ state: "off" });
    expect(statusAt([monday], 1, at("2026-10-12", 1, "09:30"))).toMatchObject({ state: "in-class" });
  });

  it("reads a meeting imported without dates as running every week", () => {
    expect(statusAt([dateless], 1, at("2026-10-08", 4, "10:00"))).toMatchObject({ state: "in-class" });
  });
});

describe("inWeek", () => {
  it("keeps only the meetings that run in that week", () => {
    const all = [...wednesday, monday, dateless];
    expect(inWeek(all, "2026-09-28").map((s) => s.courseCode)).toEqual(["COMP4020", "COMP3320", "COMP3320", "COMP4691"]);
    // Labour Day week: the Monday lecture drops out, the rest stays
    expect(inWeek(all, "2026-10-05").map((s) => s.day)).toEqual([3, 3, 4]);
    // a week none of the dated meetings run in
    expect(inWeek(all, "2026-09-14").map((s) => s.courseCode)).toEqual(["COMP4691"]);
  });
});

describe("canberraNow", () => {
  it("reads campus time and date, not the server's UTC", () => {
    // 00:45 UTC on Wednesday 30 Sep 2026 is 10:45 AEST in Canberra
    expect(canberraNow(new Date("2026-09-30T00:45:00Z"))).toEqual({ date: "2026-09-30", day: 3, minutes: 10 * 60 + 45 });
    // 23:30 UTC on Sunday is already 10:30 Monday in Canberra (AEDT from 4 Oct)
    expect(canberraNow(new Date("2026-10-04T23:30:00Z"))).toEqual({ date: "2026-10-05", day: 1, minutes: 10 * 60 + 30 });
  });
});
