import type { Slot } from "./timetable";

// Where each class sits on the week grid. Every person shown gets their own
// lane in each day column, always in the same order, so a gap running
// across all the lanes reads as time everyone has free. A person's own
// clashes (Allocate+ happily allocates overlapping lectures) split their
// lane into sub-lanes rather than drawing one block over another.

export type Placed = Slot & { left: number; width: number; top: number; height: number };

export type Grid = {
  from: number; // minutes after midnight at the top of the grid
  to: number;
  days: Placed[][]; // index 0 = Monday
};

const HOUR = 60;

export function placeOnGrid(slots: Slot[], people: number[]): Grid {
  // Always show a normal teaching day; stretch for anything outside it.
  const from = Math.min(8 * HOUR, ...slots.map((s) => Math.floor(s.start / HOUR) * HOUR));
  const to = Math.max(18 * HOUR, ...slots.map((s) => Math.ceil(s.end / HOUR) * HOUR));
  const span = to - from;
  const lane = 100 / Math.max(people.length, 1);

  const days: Placed[][] = [[], [], [], [], []];
  for (let day = 1; day <= 5; day++) {
    for (const [index, personId] of people.entries()) {
      const mine = slots
        .filter((s) => s.day === day && s.personId === personId)
        .sort((a, b) => a.start - b.start || a.end - b.end);

      // Greedy interval partitioning: each block takes the first sub-lane
      // that's free by its start time.
      const subLaneEnds: number[] = [];
      const subLane = mine.map((s) => {
        let i = subLaneEnds.findIndex((end) => end <= s.start);
        if (i < 0) i = subLaneEnds.push(0) - 1;
        subLaneEnds[i] = s.end;
        return i;
      });
      const subWidth = lane / Math.max(subLaneEnds.length, 1);

      mine.forEach((s, i) => {
        days[day - 1].push({
          ...s,
          left: index * lane + subLane[i] * subWidth,
          width: subWidth,
          top: ((s.start - from) / span) * 100,
          height: ((s.end - s.start) / span) * 100,
        });
      });
    }
    days[day - 1].sort((a, b) => a.start - b.start || a.left - b.left);
  }
  return { from, to, days };
}

// Light fills that keep dark text readable; the person's name is always in
// the block too, so colour is never the only thing telling people apart.
export const COLOURS = [
  { fill: "#d6e6ff", edge: "#2f6fd6" },
  { fill: "#ffdcc7", edge: "#c8561b" },
  { fill: "#d5f0d1", edge: "#2e8a3e" },
  { fill: "#eadbff", edge: "#7a45c9" },
  { fill: "#fff0b8", edge: "#a88400" },
  { fill: "#ffd3de", edge: "#c43b63" },
  { fill: "#cdf0ee", edge: "#1f8a85" },
  { fill: "#e7e2d8", edge: "#7a6a4f" },
];
