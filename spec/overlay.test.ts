import { beforeAll, describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { type Visitor, importCalendar, makeTimetable, page, post } from "./http";

// The overlay's promises, driven over HTTP against the running app: a friend
// added by code is on your grid on the next page load, and "you share a
// class" means the same Allocate+ group, not merely the same course.
//
// Every request pins the week: the grid defaults to the real current week,
// and the fixtures' dates are in late September 2026, so an unpinned test
// would pass on the day it was written and fail a week later.
const WEEK = "week=2026-09-28";
const OVERLAY = `/overlay/?${WEEK}`;

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
async function sharedClasses(path = OVERLAY): Promise<string[]> {
  const html = await page(path, me.cookie);
  const section = html.split('id="shared-heading"')[1] ?? "";
  return [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
}

describe("the overlay", () => {
  it("puts a friend's classes on your grid once you add their code", async () => {
    const html = await page(OVERLAY, me.cookie);
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
    const html = await page(OVERLAY, me.cookie);
    const ids = Object.fromEntries(
      [...html.matchAll(/value="(\d+)"[^>]*>\s*(You|Sam|Alex)/g)].map((m) => [m[2], m[1]]),
    );
    expect(Object.keys(ids).sort()).toEqual(["Alex", "Sam", "You"]);
    const onlyAlex = await page(`${OVERLAY}&filtered=1&show=${ids.You}&show=${ids.Alex}`, me.cookie);
    expect(onlyAlex).toContain('who-full">Alex');
    expect(onlyAlex).not.toContain("COMP2100");
    const shared = await sharedClasses(`${OVERLAY}&filtered=1&show=${ids.You}&show=${ids.Alex}`);
    expect(shared.some((line) => line.includes("Tutorial 04"))).toBe(false);
  });
});

describe("free together", () => {
  // the "Free together" list, one line per weekday
  async function freeTimes(): Promise<Record<string, string>> {
    const html = await page(OVERLAY, me.cookie);
    const section = html.split('id="free-heading"')[1]?.split("</section>")[0] ?? "";
    return Object.fromEntries(
      [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => {
        const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const [day, times] = text.split(": ");
        return [day, times];
      }),
    );
  }

  it("finds the gaps when nobody shown has class", async () => {
    const free = await freeTimes();
    // Wed: our tute 10:30–12:00, Alex's tute 13:00–14:30
    expect(free.Wed).toBe("09:00–10:30, 12:00–13:00, 14:30–17:00");
    // Mon: only Sam's lecture 14:00–16:00
    expect(free.Mon).toBe("09:00–14:00, 16:00–17:00");
    expect(free.Tue).toBe("09:00–17:00");
  });
});

describe("someone else's import", () => {
  it("can't move a class in a friend's week, even the same class", async () => {
    // a stranger claims our COMP4020 TutA 04 meets on Friday at 07:00
    const stranger = await makeTimetable("Stranger");
    const moved = weekly(
      { ...COMP4020, activity: "TutA", group: "04", start: "0700", end: "0800" },
      WEEKS.fri,
    );
    await importCalendar(stranger, myTimetable(moved));

    const week = (await page(OVERLAY, me.cookie)).split('id="week-heading"')[1]?.split('id="free-heading"')[0] ?? "";
    expect(week).toContain("10:30–12:00"); // our tute, where our exports put it
    expect(week).not.toContain("07:00–08:00");
  });

  it("can't rename a course in a friend's week", async () => {
    // a stranger imports a course first, under a false title
    const stranger = await makeTimetable("Renamer");
    const course = (title: string) =>
      weekly({ course: "TITL1001", title, activity: "LecA", group: "01", start: "0900", end: "1000" }, WEEKS.tue);
    await importCalendar(stranger, myTimetable(course("Something False")));
    const late = await makeTimetable("Late importer");
    await importCalendar(late, myTimetable(course("Its Real Title")));

    const html = await page(OVERLAY, late.cookie);
    expect(html).toContain("Its Real Title");
    expect(html).not.toContain("Something False");
    // and the stranger still sees their own: titles are per person, not absent
    expect(await page(OVERLAY, stranger.cookie)).toContain("Something False");
  });
});
