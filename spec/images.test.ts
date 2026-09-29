import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { baseUrl, page } from "./http";
import { ROUTES } from "./routes";

// Every image a page shows has to load, as a plain file. The invariants
// check an image has alt text, and the readme test checks the README's
// words, but neither fetches the picture. A markdown image in the README
// was turned into a link to Astro's runtime optimiser (/_image), which
// needs sharp at runtime: it answered 200 under this test and 500
// ("MissingSharp") on a scratch server started from the same build. So no
// page may depend on it.
describe("images", () => {
  for (const route of ROUTES) {
    it(`every image on ${route} loads`, async () => {
      const doc = new JSDOM(await page(route)).window.document;
      for (const img of doc.querySelectorAll("img")) {
        const src = img.getAttribute("src") ?? "";
        expect(src, `${src} on ${route} goes through the runtime optimiser`).not.toMatch(/^\/_image/);
        const res = await fetch(new URL(src, baseUrl));
        expect(res.status, `${src} on ${route}`).toBe(200);
        expect(res.headers.get("content-type"), `${src} on ${route}`).toMatch(/^image\//);
      }
    });
  }
});
