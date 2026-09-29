import { renderSVG } from "uqr";
import { describe, expect, it } from "vitest";
import { doc, makeTimetable, post } from "./http";

// The QR codes are pictures of links that are also on the page as text, so
// the promise is that each one is a picture of exactly that link. uqr is
// deterministic, so re-encoding the link shown must give the same drawing.
// (They were also decoded from real screenshots with a QR reader, once, in
// both themes; that needs a browser, so it isn't here.)

const drawingOf = (svg: Element | null | undefined): string | undefined =>
  svg?.querySelector("path")?.getAttribute("d") ?? undefined;

// renderSVG gives markup; its one path is the drawing
function expected(link: string): string {
  const path = renderSVG(link, { ecc: "M", border: 2 }).match(/<path[^>]* d="([^"]+)"/)?.[1];
  // two missing drawings would compare equal, and prove nothing
  if (!path) throw new Error(`no drawing in the QR for ${link}`);
  return path;
}

describe("QR codes", () => {
  it("on the Friends page, draw the share link shown beside them", async () => {
    const me = await makeTimetable("Scannable");
    const page = await doc("/friends/", me.cookie);
    const link = page.querySelector("#share-link")?.textContent?.trim() ?? "";
    expect(link).toContain(`/friends/?add=${me.shareCode}`);
    const qr = page.querySelector('#share svg[role="img"]');
    expect(qr?.getAttribute("aria-label")).toBeTruthy();
    expect(drawingOf(qr)).toBe(expected(link));
  });

  it("when linking a device, draw the one-time link shown beside them", async () => {
    const me = await makeTimetable("Linking");
    const res = await post("/api/devices/link", new URLSearchParams(), me.cookie);
    const page = await doc(res.headers.get("location") ?? "", me.cookie);
    const link = page.querySelector("#device-link")?.textContent?.trim() ?? "";
    expect(link).toMatch(/\/link\/\?code=[A-Z0-9]{8}$/);
    expect(drawingOf(page.querySelector('#devices svg[role="img"]'))).toBe(expected(link));
  });
});
