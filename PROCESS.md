# Process overview

## What I built

A full-stack overlay of friends' ANU timetables, fed by the `.ics` file
MyTimetable already exports. `README.md` says what it is and what good means
here.

## How I got here

I chose timetabling, and the friends overlay over a tute swap board, then
settled four decisions before any plan: share codes instead of accounts,
one-way friending, all four overlay views, and a seeded course catalogue. That
last one didn't survive my real MyTimetable export. The export broke the schema
(COMP3320 runs LecA and LecB as separate activities, each group 01), and since
it only holds my own groups, a seeded catalogue could never offer a friend a
different tute. So I switched to importing the export itself:
[`7ddbc1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/7ddbc1e).
The same file turned out to encode the teaching break and Labour Day, which the
parser had been throwing away:
[`7a2f9c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/7a2f9c0).

From there I directed at the level of decisions and had the agent iterate
("iterate and keep working"), and the corrections came from checking against
real state rather than trusting green tests. A migration that rebuilds a table
would have wiped every pick and follow on the live volume, and was caught on a
scratch copy first:
[`585e861`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/585e861).
Shared meeting rows let anyone's import move a class in everyone's week:
[`34111b8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/34111b8).
Each migration test was seen failing before it counted.

The last stretch went to the interface: a design system, and friends split
from my own data ([`4ff5824`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/4ff5824),
[`a38b026`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/a38b026)). Then came a review with harder data than the demo,
where eight people turned the grid's one-lane-per-person layout into slivers
and it gave way to calendar-style packing:
[`36b4091`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/36b4091).

The full record, with my prompts verbatim, is `docs/process-log.md`. The rules I
hold the agent to are in `CLAUDE.md`, carried forward from A2:
[`f34fcdd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/f34fcdd).
