import { beforeAll, describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { type Visitor, importCalendar, makeTimetable, page, post } from "./http";

// The overlay's promises, driven over HTTP against the running app: a friend
// added by code is on your grid on the next page load, and "you share a
// class" means the same Allocate+ group, not merely the same course.

const COMP4020 = { course: "COMP4020", title: "Agentic Coding Studio" };
const lecture = weekly({ ...COMP4020, activity: "LecA", group: "01", start: "1100", end: "1300" }, WEEKS.thu);
const tute = (group: string, start: string, end: string) =>
  weekly({ ...COMP4020, activity: "TutA", group, start, end }, WEEKS.wed);
const design = weekly(
  { course: "COMP2100", title: "Software Design", activity: "LecA", group: "01", start: "1400", end: "1600" },
  WEEKS.mon,
);

let me: Visitor;
let sam: Visitor;
let alex: Visitor;

beforeAll(async () => {
  me = await makeTimetable("Me");
  sam = await makeTimetable("Sam");
  alex = await makeTimetable("Alex");
  await importCalendar(me, myTimetable([...lecture, ...tute("04", "1030", "1200")]));
  await importCalendar(sam, myTimetable([...tute("04", "1030", "1200"), ...design]));
  await importCalendar(alex, myTimetable([...lecture, ...tute("05", "1300", "1430")]));
  for (const friend of [sam, alex]) {
    await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), me.cookie);
  }
});

// the "Classes you share" section's list items, as text
async function sharedClasses(path = "/overlay/"): Promise<string[]> {
  const html = await page(path, me.cookie);
  const section = html.split('id="shared-heading"')[1] ?? "";
  return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
}

describe("the overlay", () => {
  it("puts a friend's classes on your grid once you add their code", async () => {
    const html = await page("/overlay/", me.cookie);
    expect(html).toContain("COMP2100"); // only Sam takes it
  });

  it("lists a class as shared only with friends in the same group", async () => {
    const shared = await sharedClasses();
    const tuteLine = shared.find((line) => line.includes("Tutorial 04"));
    expect(tuteLine).toContain("with Sam");
    expect(tuteLine).not.toContain("Alex"); // Alex is in tute 05
    const lectureLine = shared.find((line) => line.includes("Lecture 01"));
    expect(lectureLine).toContain("with Alex");
  });

  it("drops a friend from the grid when they're toggled off", async () => {
    const html = await page("/overlay/", me.cookie);
    const ids = Object.fromEntries(
      [...html.matchAll(/value="(\d+)"[^>]*>\s*(You|Sam|Alex)/g)].map((m) => [m[2], m[1]]),
    );
    expect(Object.keys(ids).sort()).toEqual(["Alex", "Sam", "You"]);
    const onlyAlex = await page(`/overlay/?filtered=1&show=${ids.You}&show=${ids.Alex}`, me.cookie);
    expect(onlyAlex).toContain('class="who">Alex');
    expect(onlyAlex).not.toContain("COMP2100");
    const shared = await sharedClasses(`/overlay/?filtered=1&show=${ids.You}&show=${ids.Alex}`);
    expect(shared.some((line) => line.includes("Tutorial 04"))).toBe(false);
  });
});
