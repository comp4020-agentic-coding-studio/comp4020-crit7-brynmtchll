import { describe, expect, it } from "vitest";
import { MAX_FAILURES } from "../src/lib/limits";
import { makeTimetable, page, post } from "./http";

// A code is a permission, so guessing codes is slow: after MAX_FAILURES
// failed lookups in ten minutes a client is refused, even for a right code,
// wherever it tries (adding a friend, a share link, a device link). Each
// test is its own client, so the rest of the suite keeps its allowance.

const as = (ip: string) => ({ "fly-client-ip": ip });
const location = (res: Response) => res.headers.get("location") ?? "";

describe("guessing codes", () => {
  it("refuses a client after too many codes that don't match, even a right one", async () => {
    const guesser = await makeTimetable("Guesser");
    const target = await makeTimetable("Target");
    const client = as("203.0.113.10");
    for (let i = 0; i < MAX_FAILURES; i++) {
      const res = await post("/api/friends", new URLSearchParams({ code: `ZZZZ${i}` }), guesser.cookie, client);
      expect(location(res)).toContain("friend=unknown");
    }
    const right = await post("/api/friends", new URLSearchParams({ code: target.shareCode }), guesser.cookie, client);
    expect(location(right)).toContain("friend=limited");
    expect(await page("/me/?friend=limited", guesser.cookie)).toContain("Too many codes");
  });

  it("counts only failures, and keeps clients apart", async () => {
    const typo = await makeTimetable("Typo");
    const friend = await makeTimetable("Friend of typo");
    const client = as("203.0.113.11");
    await post("/api/friends", new URLSearchParams({ code: "WR0NG1" }), typo.cookie, client);
    const res = await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), typo.cookie, client);
    expect(location(res)).toContain("friend=added");
  });

  it("shares one allowance across share links, adding and device codes", async () => {
    const person = await makeTimetable("Prober");
    const client = as("203.0.113.12");
    // a GET naming a code's owner is as good as adding them, so it counts
    for (let i = 0; i < MAX_FAILURES; i++) await page(`/?add=QQQQ${i}`, "", client);
    const claim = await post("/api/devices/claim", new URLSearchParams({ code: "ABCD2345" }), "", client);
    expect(location(claim)).toContain("failed=limited");
    const link = await page(`/me/?add=${person.shareCode}`, "", client);
    expect(link).not.toContain("Prober"); // refused before the lookup
    // another client still gets the share link
    expect(await page(`/?add=${person.shareCode}`, "", as("203.0.113.13"))).toContain("Prober");
  });
});
