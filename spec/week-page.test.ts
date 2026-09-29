import { describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { doc, importCalendar, makeTimetable, post, text } from "./http";

// The week page's guidance: a checklist until you're set up, an empty
// state that says what to do, and "Right now" only where it means something.

const lecture = weekly(
  { course: "WEEK1010", title: "Weekly", activity: "LecA", group: "01", start: "0900", end: "1000" },
  WEEKS.mon,
);

const checklist = async (cookie: string) => {
  const page = await doc("/overlay/?week=2026-09-28", cookie);
  const card = page.querySelector('[aria-labelledby="welcome-heading"]');
  return {
    shown: card !== null,
    progress: text(card?.querySelector(".card-head .fine")),
    done: [...(card?.querySelectorAll("li.done .step") ?? [])].map((el) => text(el).replace(" (done)", "")),
  };
};

describe("the week page", () => {
  it("walks a new person through getting set up, ticking steps off", async () => {
    const me = await makeTimetable("Newcomer");
    expect(await checklist(me.cookie)).toEqual({ shown: true, progress: "0 of 3 done", done: [] });
    await importCalendar(me, myTimetable(lecture));
    const friend = await makeTimetable("First friend");
    await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), me.cookie);
    expect(await checklist(me.cookie)).toEqual({
      shown: true,
      progress: "2 of 3 done",
      done: ["Import your timetable", "Add a friend"],
    });
  });

  it("hides the checklist on this device when asked", async () => {
    const me = await makeTimetable("Not now");
    const res = await post("/api/welcome", new URLSearchParams(), me.cookie);
    const hidden = (res.headers.get("set-cookie") ?? "").split(";")[0];
    expect(hidden).toBe("welcome=hidden");
    expect((await checklist(`${me.cookie}; ${hidden}`)).shown).toBe(false);
  });

  it("says what to do when your week is empty", async () => {
    const me = await makeTimetable("Empty week");
    const grid = (await doc("/overlay/?week=2026-09-28", me.cookie)).querySelector("#grid");
    expect(text(grid)).toContain("Your week is empty until you import your timetable.");
    expect(grid?.querySelector('a[href="/me/#import"]')).toBeTruthy();
  });

  it("shows Right now on the current week, not on a week you've paged to", async () => {
    const me = await makeTimetable("Paging");
    await importCalendar(me, myTimetable(lecture));
    expect((await doc("/overlay/", me.cookie)).querySelector("#now-heading")).toBeTruthy();
    expect((await doc("/overlay/?week=2026-01-05", me.cookie)).querySelector("#now-heading")).toBeNull();
  });

  it("keeps an Update button for when there's no JavaScript to apply the toggles", async () => {
    const me = await makeTimetable("No script");
    const button = (await doc("/overlay/", me.cookie)).querySelector("#people button.apply");
    expect(button).toBeTruthy();
    expect(button?.hasAttribute("hidden")).toBe(false);
  });
});
