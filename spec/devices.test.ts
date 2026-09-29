import { describe, expect, it } from "vitest";
import { type Visitor, makeTimetable, page, post, shareCodeOf } from "./http";

// A timetable can live on several devices: a one-time code made on one
// device opens it on another, and each device can be signed out alone.

async function linkCode(visitor: Visitor): Promise<string> {
  const res = await post("/api/devices/link", new URLSearchParams(), visitor.cookie);
  const code = new URL(res.headers.get("location") ?? "", "http://x").searchParams.get("link");
  if (!code) throw new Error("no link code on the redirect");
  return code;
}

async function claim(code: string, cookie = ""): Promise<Response> {
  return post("/api/devices/claim", new URLSearchParams({ code }), cookie);
}

const cookieFrom = (res: Response): string => (res.headers.get("set-cookie") ?? "").split(";")[0];
const shareCodeOn = shareCodeOf;

describe("linking a device", () => {
  it("opens the same timetable on the second device", async () => {
    const laptop = await makeTimetable("Linker");
    const res = await claim(await linkCode(laptop));
    expect(res.status).toBe(303);
    const phone = cookieFrom(res);
    expect(phone).not.toBe(laptop.cookie);
    expect(await shareCodeOn(phone)).toBe(laptop.shareCode);
    expect(await page("/me/", laptop.cookie)).toContain("on 2 devices");
  });

  it("names the timetable before anything changes, and a look doesn't spend the code", async () => {
    const laptop = await makeTimetable("Previewed");
    const code = await linkCode(laptop);
    expect(await page(`/link/?code=${code}`)).toContain("Previewed");
    expect(await page(`/link/?code=${code}`)).toContain("Previewed"); // a chat app's preview, then the person
    expect((await claim(code)).headers.get("location")).toBe("/overlay/");
  });

  it("works once", async () => {
    const laptop = await makeTimetable("Once");
    const code = await linkCode(laptop);
    await claim(code);
    const again = await claim(code);
    expect(again.headers.get("location")).toContain("failed=1");
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("accepts the code as typed, dash and lower case included", async () => {
    const laptop = await makeTimetable("Typist");
    const code = await linkCode(laptop);
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
    expect(await shareCodeOn(cookieFrom(await claim(typed)))).toBe(laptop.shareCode);
  });
});

describe("signing out", () => {
  it("signs out one device and leaves the other", async () => {
    const laptop = await makeTimetable("Leaver");
    const phone = cookieFrom(await claim(await linkCode(laptop)));
    await post("/api/devices/sign-out", new URLSearchParams({ which: "this" }), phone);
    expect(await page("/me/", phone)).toContain("don't have a timetable on this device");
    expect(await shareCodeOn(laptop.cookie)).toBe(laptop.shareCode);
  });

  it("signs out every other device", async () => {
    const laptop = await makeTimetable("Lost phone");
    const phone = cookieFrom(await claim(await linkCode(laptop)));
    await post("/api/devices/sign-out", new URLSearchParams({ which: "others" }), laptop.cookie);
    expect(await page("/me/", phone)).toContain("don't have a timetable on this device");
    expect(await page("/me/", laptop.cookie)).toContain("only on this device");
  });
});
