import { describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { type Visitor, doc, importCalendar, makeTimetable, page, post, shareCodeOf, text } from "./http";

// Knowing a share code is the permission to see someone's week, so a person
// can see who has theirs, take it back, replace the code, and delete
// themselves. A share link carries the code through making a timetable.

const OVERLAY = "/overlay/?week=2026-09-28";
const tute = weekly(
  { course: "PRIV4020", title: "Privacy Studio", activity: "TutA", group: "01", start: "1030", end: "1200" },
  WEEKS.wed,
);

const add = (who: Visitor, code: string) => post("/api/friends", new URLSearchParams({ code }), who.cookie);
// the names listed under a heading on someone's Friends page
async function namesOn(cookie: string, headingId: string, path = "/friends/"): Promise<string[]> {
  const page = await doc(path, cookie);
  return [...page.querySelectorAll(`[aria-labelledby="${headingId}"] .person-name`)].map((el) => text(el));
}

describe("who can see you", () => {
  it("lists the people who added your code, and removing one takes you off their week", async () => {
    const me = await makeTimetable("Watched");
    const fan = await makeTimetable("Fan");
    await importCalendar(me, myTimetable(tute));
    await add(fan, me.shareCode);
    expect(await namesOn(me.cookie, "visible-heading")).toEqual(["Fan"]);
    expect(await page(OVERLAY, fan.cookie)).toContain("PRIV4020");

    const ids = (await page("/friends/", me.cookie)).match(/name="follower" value="(\d+)"/);
    await post("/api/friends/remove-follower", new URLSearchParams({ follower: ids?.[1] ?? "" }), me.cookie);
    expect(await namesOn(me.cookie, "visible-heading")).toEqual([]);
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
    const newCode = await shareCodeOf(me.cookie);
    expect(newCode).toBeTruthy();
    expect(newCode).not.toBe(oldCode);

    expect((await add(late, oldCode)).headers.get("location")).toContain("friend=unknown");
    expect((await add(late, newCode ?? "")).headers.get("location")).toContain("friend=added");
    expect(await namesOn(me.cookie, "visible-heading")).toEqual(["Early", "Late"]);
  });
});

describe("deleting your timetable", () => {
  it("needs the box ticked", async () => {
    const me = await makeTimetable("Hesitant");
    const res = await post("/api/people/delete", new URLSearchParams(), me.cookie);
    expect(res.headers.get("location")).toContain("delete=unconfirmed");
    expect(await shareCodeOf(me.cookie)).toBe(me.shareCode);
  });

  it("removes you everywhere: this device, your code, and friends' weeks", async () => {
    const me = await makeTimetable("Leaving");
    const friend = await makeTimetable("Stays");
    await importCalendar(me, myTimetable(tute));
    await add(friend, me.shareCode);
    await add(me, friend.shareCode);
    // both lists name them first, so the empty lists after mean something
    expect(await namesOn(friend.cookie, "friends-heading")).toEqual(["Leaving"]);
    expect(await namesOn(friend.cookie, "visible-heading")).toEqual(["Leaving"]);

    const res = await post("/api/people/delete", new URLSearchParams({ confirm: "yes" }), me.cookie);
    expect(res.headers.get("location")).toBe("/?deleted=1");
    expect(await page("/me/", me.cookie)).toContain("don't have a timetable on this device");
    expect((await add(friend, me.shareCode)).headers.get("location")).toContain("friend=unknown");
    expect(await page(OVERLAY, friend.cookie)).not.toContain("Leaving");
    expect(await namesOn(friend.cookie, "friends-heading")).toEqual([]);
    expect(await namesOn(friend.cookie, "visible-heading")).toEqual([]);
  });
});

describe("a share link", () => {
  it("carries the code through making a timetable, then offers to add them", async () => {
    const sharer = await makeTimetable("Sharer");
    // a newcomer opens the link with no timetable yet
    expect(await page(`/friends/?add=${sharer.shareCode}`)).toContain(`href="/?add=${sharer.shareCode}"`);
    expect(text((await doc(`/?add=${sharer.shareCode}`)).querySelector("h1"))).toBe(
      "Sharer wants to share timetables with you",
    );

    const made = await post("/api/people", new URLSearchParams({ name: "Newcomer", add: sharer.shareCode }));
    expect(made.headers.get("location")).toBe(`/friends/?add=${sharer.shareCode}`);
    const cookie = (made.headers.get("set-cookie") ?? "").split(";")[0];
    const offer = await doc(`/friends/?add=${sharer.shareCode}`, cookie);
    expect(text(offer.querySelector("#invite-heading"))).toBe("Add Sharer?");
    // looking at the offer added nobody
    expect(await namesOn(cookie, "friends-heading")).toEqual([]);

    await post("/api/friends", new URLSearchParams({ code: sharer.shareCode }), cookie);
    expect(await namesOn(cookie, "friends-heading")).toEqual(["Sharer"]);
  });
});
