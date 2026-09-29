import { describe, expect, it } from "vitest";
import { doc, get, makeTimetable, post, text } from "./http";

// Where things live: signed in, the app's home is your week; the nav says
// where you are; friends and your own data have a page each; and links
// people were given before a page moved still work.

const navOf = async (path: string, cookie = "") => {
  const page = await doc(path, cookie);
  const links = [...page.querySelectorAll('nav[aria-label="site"] a')];
  return {
    labels: links.map((a) => text(a)),
    current: links.filter((a) => a.getAttribute("aria-current") === "page").map((a) => text(a)),
  };
};

describe("the app's pages", () => {
  it("sends a signed-in visitor from the home page to their week", async () => {
    const me = await makeTimetable("Returning");
    const home = await get("/", me.cookie);
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("/overlay/");
    // unless they came by a friend's link, which goes to the offer
    const invited = await get("/?add=ABC234", me.cookie);
    expect(invited.headers.get("location")).toBe("/friends/?add=ABC234");
  });

  it("names where you can go, and marks where you are", async () => {
    expect((await navOf("/")).labels).toEqual(["Home", "Link a device", "About"]);
    const me = await makeTimetable("Navigator");
    const friends = await navOf("/friends/", me.cookie);
    expect(friends.labels).toEqual(["Week", "Friends", "My timetable", "About"]);
    expect(friends.current).toEqual(["Friends"]);
    expect((await navOf("/overlay/", me.cookie)).current).toEqual(["Week"]);
  });

  it("keeps old share links, which pointed at /me/, working", async () => {
    const res = await get("/me/?add=ABC234");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/friends/?add=ABC234");
  });

  it("lets you change your name, and friends see the new one", async () => {
    const me = await makeTimetable("Typo Nmae");
    const friend = await makeTimetable("Onlooker");
    await post("/api/friends", new URLSearchParams({ code: me.shareCode }), friend.cookie);
    await post("/api/people/rename", new URLSearchParams({ name: "  Fixed   Name " }), me.cookie);
    const names = [...(await doc("/friends/", friend.cookie)).querySelectorAll(".person-name")].map((el) => text(el));
    expect(names).toEqual(["Fixed Name"]);
    const empty = await post("/api/people/rename", new URLSearchParams({ name: "   " }), me.cookie);
    expect(empty.headers.get("location")).toContain("renamed=empty");
  });
});
