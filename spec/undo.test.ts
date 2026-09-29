import { describe, expect, it } from "vitest";
import { doc, makeTimetable, page, post, text } from "./http";

// Removing someone happens straight away and offers an undo. Undo adds a
// follow without a share code, so it only ever reverses a removal the
// same person really just made.

const names = async (cookie: string, headingId: string): Promise<string[]> =>
  [...(await doc("/friends/", cookie)).querySelectorAll(`[aria-labelledby="${headingId}"] .person-name`)].map((el) =>
    text(el),
  );
const idOf = async (cookie: string, field: "friend" | "follower"): Promise<string> =>
  (await page("/friends/", cookie)).match(new RegExp(`name="${field}" value="(\\d+)"`))?.[1] ?? "";

describe("undoing a removal", () => {
  it("puts a friend you just removed back on your week", async () => {
    const me = await makeTimetable("Hasty");
    const friend = await makeTimetable("Mistap");
    await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), me.cookie);
    const removed = await post("/api/friends/remove", new URLSearchParams({ friend: await idOf(me.cookie, "friend") }), me.cookie);
    expect(removed.headers.get("location")).toContain("removed=friend");
    expect(await names(me.cookie, "friends-heading")).toEqual([]);

    const offer = await doc("/friends/?removed=friend", me.cookie);
    expect(text(offer.querySelector('.notice[role="status"]'))).toContain("Removed Mistap from your week.");
    expect(offer.querySelector('form[action="/api/friends/undo"] button')).toBeTruthy();

    await post("/api/friends/undo", new URLSearchParams(), me.cookie);
    expect(await names(me.cookie, "friends-heading")).toEqual(["Mistap"]);
  });

  it("puts back someone you'd stopped seeing you", async () => {
    const me = await makeTimetable("Private");
    const fan = await makeTimetable("Fan again");
    await post("/api/friends", new URLSearchParams({ code: me.shareCode }), fan.cookie);
    await post("/api/friends/remove-follower", new URLSearchParams({ follower: await idOf(me.cookie, "follower") }), me.cookie);
    expect(await names(me.cookie, "visible-heading")).toEqual([]);
    await post("/api/friends/undo", new URLSearchParams(), me.cookie);
    expect(await names(me.cookie, "visible-heading")).toEqual(["Fan again"]);
  });

  it("can't be used to follow someone whose code you never had", async () => {
    const stranger = await makeTimetable("Stranger");
    const snoop = await makeTimetable("Snoop");
    // Stranger's id, learnt some other way: add and remove them from a
    // throwaway account that did have the code
    const throwaway = await makeTimetable("Throwaway");
    await post("/api/friends", new URLSearchParams({ code: stranger.shareCode }), throwaway.cookie);
    const strangerId = await idOf(throwaway.cookie, "friend");
    expect(strangerId).not.toBe("");

    // Snoop "removes" Stranger, whom they never followed, then undoes it
    const forged = await post("/api/friends/remove", new URLSearchParams({ friend: strangerId }), snoop.cookie);
    expect(forged.headers.get("location")).not.toContain("removed=");
    const undo = await post("/api/friends/undo", new URLSearchParams(), snoop.cookie);
    expect(undo.headers.get("location")).toContain("undone=expired");
    expect(await names(snoop.cookie, "friends-heading")).toEqual([]);
  });

  it("belongs to the person who removed, not to anyone who asks", async () => {
    const me = await makeTimetable("Remover");
    const friend = await makeTimetable("Removed one");
    const other = await makeTimetable("Bystander");
    await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), me.cookie);
    await post("/api/friends/remove", new URLSearchParams({ friend: await idOf(me.cookie, "friend") }), me.cookie);
    await post("/api/friends/undo", new URLSearchParams(), other.cookie);
    expect(await names(other.cookie, "friends-heading")).toEqual([]);
    expect(await names(me.cookie, "friends-heading")).toEqual([]);
  });
});
