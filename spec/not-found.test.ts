import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { baseUrl } from "./http";

// A wrong address still lands inside the app: a real 404 status, the site's
// own navigation, and a way back, rather than the framework's default page.
describe("a page that doesn't exist", () => {
  it("answers 404 with the app's navigation and a way back", async () => {
    const res = await fetch(new URL("/no-such-page/", baseUrl));
    expect(res.status).toBe(404);
    const doc = new JSDOM(await res.text()).window.document;
    expect(doc.querySelector("h1")?.textContent).toBe("Page not found");
    expect(doc.querySelector('nav[aria-label="site"]')).toBeTruthy();
    expect(doc.querySelector('main a[href="/"]')?.textContent).toContain("Make a timetable");
  });
});
