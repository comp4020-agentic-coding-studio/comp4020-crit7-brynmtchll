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

export type SharedClass = {
  classId: number;
  courseCode: string;
  activity: string;
  group: string;
  meetings: { day: number; start: number; end: number; room: string | null }[];
  friends: number[]; // who you share it with, in overlay order
};

// Classes you hold that a shown friend holds too. Because the catalogue is
// shared, "the same class" is one row: this is a group-by on class id, not a
// fuzzy match on course code and time.
export function sharedWith(slots: Slot[], me: number, people: number[]): SharedClass[] {
  const byClass = new Map<number, Slot[]>();
  for (const s of slots) {
    if (!people.includes(s.personId)) continue;
    byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s]);
  }
  const shared: SharedClass[] = [];
  for (const [classId, rows] of byClass) {
    const holders = new Set(rows.map((r) => r.personId));
    if (!holders.has(me) || holders.size < 2) continue;
    const mine = rows.filter((r) => r.personId === me);
    shared.push({
      classId,
      courseCode: mine[0].courseCode,
      activity: mine[0].activity,
      group: mine[0].group,
      meetings: mine.map(({ day, start, end, room }) => ({ day, start, end, room })),
      friends: people.filter((p) => p !== me && holders.has(p)),
    });
  }
  return shared.sort(
    (a, b) => a.meetings[0].day - b.meetings[0].day || a.meetings[0].start - b.meetings[0].start,
  );
}

export type Gap = { day: number; start: number; end: number };

// The working day free time is looked for in, and the shortest gap worth
// suggesting: half an hour is the least you can do anything together in.
export const FREE_WINDOW = { start: 9 * HOUR, end: 17 * HOUR };
const SHORTEST_GAP = 30;

// Time in the working day when nobody shown has a class: merge everyone's
// busy intervals per day, then take what's left between them.
export function freeTogether(slots: Slot[], people: number[]): Gap[] {
  const gaps: Gap[] = [];
  for (let day = 1; day <= 5; day++) {
    const busy = slots
      .filter((s) => s.day === day && people.includes(s.personId))
      .map((s) => [s.start, s.end] as const)
      .sort((a, b) => a[0] - b[0]);
    let cursor = FREE_WINDOW.start;
    for (const [start, end] of [...busy, [FREE_WINDOW.end, FREE_WINDOW.end] as const]) {
      const gapEnd = Math.min(start, FREE_WINDOW.end);
      if (gapEnd - cursor >= SHORTEST_GAP) gaps.push({ day, start: cursor, end: gapEnd });
      cursor = Math.max(cursor, end);
      if (cursor >= FREE_WINDOW.end) break;
    }
  }
  return gaps;
}
