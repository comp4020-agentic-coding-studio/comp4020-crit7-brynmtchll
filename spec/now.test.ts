import { describe, expect, it } from "vitest";
import { canberraNow, statusAt } from "../src/lib/overlay";
import type { Slot } from "../src/lib/timetable";

// "Right now" on the overlay: where a person is, from their weekly timetable
// and the time on campus.

const slot = (day: number, start: string, end: string, courseCode: string): Slot => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return {
    personId: 1, classId: 1, courseCode, courseTitle: "", activity: "LecA", group: "01",
    day, start: m(start), end: m(end), room: null,
  };
};
// Wednesday: a tute, then a lab after a lunch gap
const wednesday = [slot(3, "10:30", "12:00", "COMP4020"), slot(3, "13:00", "14:30", "COMP3320")];
const at = (day: number, time: string) => ({
  day,
  minutes: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
});

describe("statusAt", () => {
  it("is in class from the start of a class up to (not including) its end", () => {
    expect(statusAt(wednesday, 1, at(3, "10:30"))).toMatchObject({ state: "in-class", slot: { courseCode: "COMP4020" } });
    expect(statusAt(wednesday, 1, at(3, "11:59"))).toMatchObject({ state: "in-class" });
    expect(statusAt(wednesday, 1, at(3, "12:00"))).toMatchObject({ state: "free", next: { courseCode: "COMP3320" } });
  });

  it("names the next class when free before or between classes", () => {
    expect(statusAt(wednesday, 1, at(3, "08:00"))).toMatchObject({ state: "free", next: { courseCode: "COMP4020" } });
  });

  it("tells a finished day from a day with no classes", () => {
    expect(statusAt(wednesday, 1, at(3, "15:00"))).toEqual({ state: "done" });
    expect(statusAt(wednesday, 1, at(4, "11:00"))).toEqual({ state: "none" });
    expect(statusAt(wednesday, 2, at(3, "11:00"))).toEqual({ state: "none" }); // someone else's
  });
});

describe("canberraNow", () => {
  it("reads campus time, not the server's UTC", () => {
    // 00:45 UTC on Wednesday 30 Sep 2026 is 10:45 AEST in Canberra
    expect(canberraNow(new Date("2026-09-30T00:45:00Z"))).toEqual({ day: 3, minutes: 10 * 60 + 45 });
    // after daylight saving starts (4 Oct): 23:30 UTC Sun is 10:30 Mon AEDT
    expect(canberraNow(new Date("2026-10-04T23:30:00Z"))).toEqual({ day: 1, minutes: 10 * 60 + 30 });
  });
});
