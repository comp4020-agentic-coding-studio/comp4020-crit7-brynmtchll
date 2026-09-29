import { beforeAll, describe, expect, it } from "vitest";
import { myTimetable, weekly } from "./fixtures/mytimetable";
import { type Visitor, doc, importCalendar, makeTimetable, page, text } from "./http";

// The grid shows a real week, going by the dates in the export: a class the
// export leaves out of a week (Labour Day, the teaching break) isn't drawn
// in that week, and a one-off session appears only in its own.

// The same COMP4020 TutA 04 other test files import, with different dates
// on purpose: each person's meetings are their own, so another file's
// import of the class can't change this timetable (it used to, when
// meetings were shared rows).
const HPC = { course: "COMP3320", title: "HPC" };
const STUDIO = { course: "COMP4020", title: "Agentic Coding Studio" };

let me: Visitor;

beforeAll(async () => {
  me = await makeTimetable("Weeks");
  await importCalendar(
    me,
    myTimetable([
      // Monday lecture: no 5 Oct (Labour Day)
      ...weekly({ ...HPC, activity: "LecA", group: "01", start: "0900", end: "1000" }, ["20260928", "20261012"]),
      ...weekly({ ...STUDIO, activity: "TutA", group: "04", start: "1030", end: "1200" }, ["20260930", "20261007", "20261014"]),
      // a one-off assessment on Friday 9 Oct
      { ...HPC, activity: "AsmA", group: "01", date: "20261009", start: "1400", end: "1600" },
    ]),
  );
});

// just the week grid, as text: "Right now" above it runs on the real clock
async function grid(week: string): Promise<string> {
  return text((await doc(`/overlay/?week=${week}`, me.cookie)).querySelector("#grid"));
}

describe("the week grid", () => {
  it("draws a week's classes", async () => {
    const week = await grid("2026-09-28");
    expect(week).toContain("COMP3320");
    expect(week).toContain("COMP4020");
  });

  it("leaves out a class the export skips that week", async () => {
    const labourDay = await grid("2026-10-05");
    expect(labourDay).toContain("COMP4020");
    expect(labourDay).not.toContain("Lecture");
  });

  it("shows a one-off session only in its own week", async () => {
    expect(await grid("2026-10-05")).toContain("Assessment");
    expect(await grid("2026-10-12")).not.toContain("Assessment");
  });

  it("says so when nobody has classes that week", async () => {
    expect(await grid("2026-09-14")).toContain("Nobody shown has classes this week");
  });

  it("snaps any date to the Monday of its week", async () => {
    const heading = text((await doc("/overlay/?week=2026-10-07", me.cookie)).querySelector("#week-heading"));
    expect(heading).toContain("Week of Mon 5 Oct");
  });
});

describe("your classes", () => {
  it("lists one-off sessions apart, with their date", async () => {
    const html = await page("/me/", me.cookie);
    const oneOffs = html.split("One-off sessions")[1] ?? "";
    expect(oneOffs).toContain("Fri 9 Oct 14:00–16:00");
  });
});
