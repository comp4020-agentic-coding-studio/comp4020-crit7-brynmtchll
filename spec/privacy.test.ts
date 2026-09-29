import { describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { type Visitor, importCalendar, makeTimetable, page, post } from "./http";

// Knowing a share code is the permission to see someone's week, so a person
// can see who has theirs, take it back, replace the code, and delete
// themselves. A share link carries the code through making a timetable.

const OVERLAY = "/overlay/?week=2026-09-28";
const tute = weekly(
  { course: "PRIV4020", title: "Privacy Studio", activity: "TutA", group: "01", start: "1030", end: "1200" },
  WEEKS.wed,
);

const add = (who: Visitor, code: string) => post("/api/friends", new URLSearchParams({ code }), who.cookie);
const namesIn = (html: string, sectionId: string): string[] => {
  const section = html.split(`id="${sectionId}"`)[1]?.split("</section>")[0] ?? "";
  return [...section.matchAll(/<li>\s*<span>([^<]+)<\/span>/g)].map((m) => m[1]);
};

describe("who can see you", () => {
  it("lists the people who added your code, and removing one takes you off their overlay", async () => {
    const me = await makeTimetable("Watched");
    const fan = await makeTimetable("Fan");
    await importCalendar(me, myTimetable(tute));
    await add(fan, me.shareCode);
    expect(namesIn(await page("/me/", me.cookie), "visible-heading")).toEqual(["Fan"]);
    expect(await page(OVERLAY, fan.cookie)).toContain("PRIV4020");

    const ids = (await page("/me/", me.cookie)).match(/name="follower" value="(\d+)"/);
    await post("/api/friends/remove-follower", new URLSearchParams({ follower: ids?.[1] ?? "" }), me.cookie);
    expect(namesIn(await page("/me/", me.cookie), "visible-heading")).toEqual([]);
    expect(await page(OVERLAY, fan.cookie)).not.toContain("PRIV4020");
  });
});

describe("a new share code", () => {
  it("stops the old code working, and keeps the people already added", async () => {
    const me = await makeTimetable("Rotator");
    const early = await makeTimetable("Early");
    const late = await makeTimetable("Late");
    await add(early, me.shareCode);
    const oldCode = me.shareCode;
    await post("/api/people/share-code", new URLSearchParams(), me.cookie);
    const newCode = (await page("/me/", me.cookie)).match(/share-code">([A-Z0-9]+)/)?.[1];
    expect(newCode).toBeTruthy();
    expect(newCode).not.toBe(oldCode);

    expect((await add(late, oldCode)).headers.get("location")).toContain("friend=unknown");
    expect((await add(late, newCode ?? "")).headers.get("location")).toContain("friend=added");
    expect(namesIn(await page("/me/", me.cookie), "visible-heading")).toEqual(["Early", "Late"]);
  });
});

describe("deleting your timetable", () => {
  it("needs the box ticked", async () => {
    const me = await makeTimetable("Hesitant");
    const res = await post("/api/people/delete", new URLSearchParams(), me.cookie);
    expect(res.headers.get("location")).toContain("delete=unconfirmed");
    expect(await page("/me/", me.cookie)).toContain(me.shareCode);
  });

  it("removes you everywhere: this device, your code, and friends' overlays", async () => {
    const me = await makeTimetable("Leaving");
    const friend = await makeTimetable("Stays");
    await importCalendar(me, myTimetable(tute));
    await add(friend, me.shareCode);
    await add(me, friend.shareCode);
    // both lists name them first, so the empty lists after mean something
    const before = await page("/me/", friend.cookie);
    expect(namesIn(before, "friends-heading")).toEqual(["Leaving"]);
    expect(namesIn(before, "visible-heading")).toEqual(["Leaving"]);

    const res = await post("/api/people/delete", new URLSearchParams({ confirm: "yes" }), me.cookie);
    expect(res.headers.get("location")).toBe("/?deleted=1");
    expect(await page("/me/", me.cookie)).toContain("don't have a timetable on this device");
    expect((await add(friend, me.shareCode)).headers.get("location")).toContain("friend=unknown");
    expect(await page(OVERLAY, friend.cookie)).not.toContain("Leaving");
    const after = await page("/me/", friend.cookie);
    expect(namesIn(after, "friends-heading")).toEqual([]);
    expect(namesIn(after, "visible-heading")).toEqual([]);
  });
});

describe("a share link", () => {
  it("carries the code through making a timetable, then offers to add them", async () => {
    const sharer = await makeTimetable("Sharer");
    // a newcomer opens the link with no timetable yet
    expect(await page(`/me/?add=${sharer.shareCode}`)).toContain(`href="/?add=${sharer.shareCode}"`);
    expect(await page(`/?add=${sharer.shareCode}`)).toContain("Sharer");

    const made = await post("/api/people", new URLSearchParams({ name: "Newcomer", add: sharer.shareCode }));
    expect(made.headers.get("location")).toBe(`/me/?add=${sharer.shareCode}#friends`);
    const cookie = (made.headers.get("set-cookie") ?? "").split(";")[0];
    const offer = await page(`/me/?add=${sharer.shareCode}`, cookie);
    expect(offer).toContain("Add Sharer?");
    // looking at the offer added nobody
    expect(namesIn(offer, "friends-heading")).toEqual([]);
  });
});
