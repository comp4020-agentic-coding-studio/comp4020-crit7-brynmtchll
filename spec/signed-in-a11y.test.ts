import axe from "axe-core";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";
import { WEEKS, myTimetable, weekly } from "./fixtures/mytimetable";
import { baseUrl, importCalendar, makeTimetable, page, post } from "./http";

// invariants.test.ts visits each route as a stranger, so it only ever sees
// the signed-out pages. The real /me/ and /overlay/ — a timetable, friends,
// the week grid, shared classes, free time — get the same accessibility
// floor here, signed in with data on them.

const pages = new Map<string, string>();

beforeAll(async () => {
  const me = await makeTimetable("Checker");
  const friend = await makeTimetable("Friend");
  const tute = weekly(
    { course: "COMP4020", title: "Agentic Coding Studio", activity: "TutA", group: "04", start: "1030", end: "1200", location: "Rm 4.03_Marie Reay Bldg 155" },
    WEEKS.wed,
  );
  const clash = [
    ...weekly({ course: "COMP3670", title: "Machine Learning", activity: "LecB", group: "01", start: "0830", end: "1000" }, WEEKS.fri),
    ...weekly({ course: "COMP3320", title: "HPC", activity: "LecB", group: "01", start: "0900", end: "1100" }, WEEKS.fri),
  ];
  await importCalendar(me, myTimetable([...tute, ...clash]));
  await importCalendar(friend, myTimetable(tute));
  await post("/api/friends", new URLSearchParams({ code: friend.shareCode }), me.cookie);
  for (const path of ["/me/", "/overlay/"]) pages.set(path, await page(path, me.cookie));
});

for (const path of ["/me/", "/overlay/"]) {
  describe(`signed in: ${path}`, () => {
    it("has exactly one top-level heading", () => {
      const doc = new JSDOM(pages.get(path)).window.document;
      expect(doc.querySelectorAll("h1").length).toBe(1);
    });

    it("has no axe violations", async () => {
      const dom = new JSDOM(pages.get(path), {
        url: new URL(path, baseUrl).href,
        runScripts: "outside-only",
        pretendToBeVisual: true,
      });
      const window = dom.window as unknown as { eval: (source: string) => void; axe: typeof axe };
      window.eval(axe.source);
      const results = await window.axe.run(dom.window.document, {
        rules: {
          "color-contrast": { enabled: false },
          "link-in-text-block": { enabled: false },
        },
      });
      const violations = results.violations.map(
        ({ id, help, nodes }) => `${id}: ${help} (${nodes.map((n) => n.target.join(" ")).join("; ")})`,
      );
      expect(violations).toEqual([]);
    });
  });
}
