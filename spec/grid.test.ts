import { describe, expect, it } from "vitest";
import { placeOnGrid } from "../src/lib/overlay";
import type { Slot } from "../src/lib/timetable";

// How classes share a day's width on the grid: only classes that overlap in
// time split it, so a crowded overlay stays readable.

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
let nextId = 1;
const slot = (personId: number, day: number, start: string, end: string): Slot => ({
  personId, classId: nextId++, courseCode: "TEST1000", courseTitle: "", activity: "LecA", group: "01",
  day, start: minutes(start), end: minutes(end), room: null, dates: [],
});
const widths = (placed: { width: number; left: number }[]) => placed.map((p) => [p.left, p.width]);

describe("placeOnGrid", () => {
  it("gives a class that overlaps nothing the whole day's width, however many people are shown", () => {
    const people = [1, 2, 3, 4, 5, 6, 7, 8];
    const grid = placeOnGrid([slot(5, 1, "09:00", "11:00"), slot(2, 1, "13:00", "14:00")], people);
    expect(widths(grid.days[0])).toEqual([[0, 100], [0, 100]]);
  });

  it("splits the width only between classes that overlap, you leftmost", () => {
    const grid = placeOnGrid(
      [slot(3, 3, "10:30", "12:00"), slot(1, 3, "10:30", "12:00"), slot(2, 3, "15:00", "16:00")],
      [1, 2, 3],
    );
    expect(grid.days[2].map((p) => [p.personId, p.left, p.width])).toEqual([
      [1, 0, 50],
      [3, 50, 50],
      [2, 0, 100],
    ]);
  });

  it("treats a chain of overlaps as one group, reusing a column once it's free", () => {
    // 9–11 overlaps 10–12, which overlaps 11:30–13; 9–11 has ended by 11:30
    const grid = placeOnGrid(
      [slot(1, 5, "09:00", "11:00"), slot(2, 5, "10:00", "12:00"), slot(3, 5, "11:30", "13:00")],
      [1, 2, 3],
    );
    expect(grid.days[4].map((p) => [p.personId, p.left, p.width])).toEqual([
      [1, 0, 50],
      [2, 50, 50],
      [3, 0, 50],
    ]);
  });
});
