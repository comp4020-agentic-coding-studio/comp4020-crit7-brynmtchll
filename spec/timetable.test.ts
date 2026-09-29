import { describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { importCalendar, makeTimetable, page } from "./http";

// Spec: "the core flow persists across a reload — create something, and it's
// still there". The thing you create is your timetable, by importing your
// MyTimetable export; every page load below is a fresh request, so what it
// shows came back out of SQLite.

const COMP4020 = { course: "COMP4020", title: "Agentic Coding Studio" };
const tute = weekly(
  { ...COMP4020, activity: "TutA", group: "04", start: "1030", end: "1200", location: "Rm 4.03_Marie Reay Bldg 155" },
  WEEKS.wed,
);
const lecture = weekly({ ...COMP4020, activity: "LecA", group: "01", start: "1100", end: "1300" }, WEEKS.thu);

describe("importing a timetable", () => {
  it("keeps the imported classes across a reload", async () => {
    const me = await makeTimetable("Importer");
    const res = await importCalendar(me, myTimetable([...tute, ...lecture]));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("import=ok");

    const html = await page("/me/", me.cookie);
    expect(html).toContain("Wed 10:30–12:00");
    expect(html).toContain("Tutorial 04");
    expect(html).toContain("Thu 11:00–13:00");
  });

  it("replaces the timetable on re-import rather than piling up", async () => {
    const me = await makeTimetable("Reimporter");
    await importCalendar(me, myTimetable([...tute, ...lecture]));
    await importCalendar(me, myTimetable(lecture));

    const html = await page("/me/", me.cookie);
    expect(html).not.toContain("Tutorial 04");
    expect(html).toContain("Lecture 01");
  });

  it("says so when the upload isn't a timetable, and keeps the old one", async () => {
    const me = await makeTimetable("Mistaken");
    await importCalendar(me, myTimetable(tute));
    const res = await importCalendar(me, "not a calendar");
    expect(res.headers.get("location")).toContain("import=empty");
    expect(await page("/me/", me.cookie)).toContain("Tutorial 04");
  });
});
