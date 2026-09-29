# Process log

Running record kept as the work happens, to draw `PROCESS.md` from later.
Prompts are **verbatim**, including typos — paraphrasing them would destroy
their value as evidence.

Not site content. `PROCESS.md` is a paragraph or two for a weekly prototype,
so this is raw material, not a draft of it.

Commit URLs take the form
`https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/<hash>`.

**Entries 1–10 are reconstructed**, written on 29 Sep from the same day's
session transcript after the harness carried over from A2 turned the log rule
back on (entry 10). The prompts are verbatim from the transcript; the
annotations are after the fact, not at the time. From entry 11 on, entries
are written as the work happens.

---

## 1. What's due

> what do i need to do for the crit this week

Pulled the crit 7 brief and spec from the course site: a full-stack
replacement for a slice of a real ANU system, deployed to Fly, with the core
flow persisting across a reload. The page was still marked draft.

## 2. Setup, and choosing timetabling

> ok do that, lets do timetabling

The crit 7 repo was already cloned (lowercase handle). Baseline `pnpm check`
green (28 tests), the Fly token worked, and the untouched starter was already
deployed and answering 200. Kept the starter stack: the spec harness assumes
it and the cutoff was the next morning.

## 3. Options

> what are some options

Grounded in ANU's actual system first: MyTimetable runs on Allocate+,
self-allocation is first-come, and the Timetable Viewer is a separate
view-only tool. Offered five slices (plan-and-allocate, a tute swap board,
comparing drafts, a friends overlay, a generator) with the agent leaning
towards the swap board and flagging the overlay as a stretch because it needs
identity.

## 4. Friends overlay, and the decisions it needed

> yep i want friends overly

Four decisions put to me before any plan, answered as:

- identity: **share code, no passwords**
- class data: **seeded ANU catalogue** (reversed in entry 7)
- overlay: **all four** views — everyone's classes, shared classes, on campus
  now, free together
- friending: **one-way, add by code**

The plan ordered the four views by priority so a minimum complete app (import,
friends, grid) would exist and deploy before the rest.

## 5. Build, before the data arrived

> yep

Built what didn't need course data while waiting for it:

- schema: [`fa93eb1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/fa93eb1)
- cookie identity and share codes: [`91bd984`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/91bd984)
- friends by code: [`5c51aeb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/5c51aeb)

Problem found: `drizzle-kit generate` stops to ask whether new tables are a
rename of the dropped `messages` table, and fails without a TTY. Worked around
by splitting into two unambiguous migrations (create, then drop).

Dead end: tried to pull real class times from the public ANU Timetable Viewer
instead of asking me. It's an ASP.NET postback app and its direct report URLs
return 500, so abandoned. Also declined to guess my enrolments from folder
names in `~/courses`.

## 6. The real export

> [pasted my full MyTimetable `.ics` export and a screenshot of the
> MyTimetable week view — not reproduced here, per the rule against
> committing a personal export]

The single most useful input of the week. It broke the schema in three
places: COMP3320 runs `LecA` and `LecB` as separate activities, both group
`01`, which the `(course, kind, group)` unique index rejects. Labs arrive in
parts (`02-P1` then its drop-in `02-P2`). The COMP4020 lecture has no room
(`NA`). It also showed that the export only holds _my_ groups, so a seeded
catalogue could never offer a friend a different tute, which undid
decision 2 in entry 4.

## 7. Import instead of a seeded catalogue

> Import the .ics (Recommended)

(answer to a question offering: import the `.ics`; seed from my file and pick
in dropdowns; or both)

Reversal of entry 4's catalogue decision. Classes now key on Allocate+'s
activity code, rooms are nullable, and a lab's parts are two meetings of one
class. The catalogue grows from imports, so a shared class is one row held by
two people. Weekly = a slot seen at least twice. One-off assessments are
skipped and counted.
[`7ddbc1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/7ddbc1e)

Correction: migrations `0001`/`0002` were regenerated rather than patched,
since they'd never been applied outside the laptop. The git history keeps the
wrong first schema.

## 8. The four views, then deploy

No new prompts: the agent worked through the agreed plan.

- grid, one lane per person, own clashes split into sub-lanes:
  [`2df4e9f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/2df4e9f).
  Deployed here, and the live site passed every probe CI runs.
- shared classes: [`27fba11`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/27fba11)
- free together: [`28de65e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/28de65e)
- right now, in Canberra time: [`29f0639`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/29f0639)
- live reload over SSE: [`cb79131`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/cb79131)
- signed-in accessibility: [`ff7558f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/ff7558f)

Corrections found by looking rather than testing:

- Screenshots of the grid (headless Chrome, seeded with my real weekly
  classes plus two made-up friends) caught checkboxes stretched to 12rem by
  the starter's `input` rule, nav links running together, and the 18:00 label
  clipped.
- A live-reload check in a real browser confirmed a friend's re-import shows
  up without touching the page. The SSE test alone only proved the event was
  sent.

Correction found by reading a test: the toggle test could pass vacuously. If
its regex found no person ids, the page showed nobody and "Sam's class is
absent" held trivially. It now asserts the ids were found first. This became
a carried-forward lesson in `CLAUDE.md`.

Decisions the agent made without asking, which I need to be able to defend:

- storing only a SHA-256 of the cookie token
- a fixed lane per person, rather than packing blocks
- free time looked for between 09:00 and 17:00, in gaps of at least 30 minutes
- "right now" ignores teaching breaks and says so
- the newest import of a class sets its meetings for everyone who holds it,
  which trusts imports

## 9. README draft

README drafted by the agent from the decisions above, flagged for me to
rewrite in my own words.
[`1c311b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/1c311b5)

## 10. The harness

> port in cluade .md from previous assignment/lab

Carried `CLAUDE.md` forward from A2. Kept my working rules, voice and
lessons. Dropped A2's course model and Slop platform traps as dead. Inverted
the base-path rule, since this app is served from the root. Added what the
MyTimetable data dictates and the dynamic stack's traps.
[`f34fcdd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/f34fcdd)

The carried rule "keep the process log as we go" is what exposed that no log
existed this week, hence this file.

## 11. Keep going

> iterate and keep working

> there is heaps of time and budget left,

