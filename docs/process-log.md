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

Pushed the day's commits (repo still private). Chose the next round by what
was wrong or admitted in the README, not by what was easy to add. Deploying
needs a read of the live database first to size the migration risk: that
read was refused by the permission system (production reads), so every
migration below was designed to be safe on any state instead.

## 12. Keep the dates

The export already records the teaching break and Labour Day (no COMP3320
Monday lecture on 5 Oct), and the parser was throwing that away by reducing
everything to a weekly shape. A new `occurrences` table keeps each meeting's
dates. The grid shows a real week with navigation, "right now" says when
someone's usual classes aren't on, and one-off assessments appear in their
own week instead of being skipped (reversing entry 7's "skip one-offs").
[`7a2f9c0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/7a2f9c0)

Problem found: with a date-dependent grid, the test files began to race.
They share one server and so one catalogue, and "the newest import sets a
class's dates" let `overlay.test.ts`'s COMP4020 tute dates overwrite
`weeks.test.ts`'s. The app is doing what it was designed to. The fixtures
disagreed about when one real class runs. Fixed with per-file course codes
and a pinned `?week=` everywhere, since the grid defaults to the real week
and an unpinned test would have gone red a week after it was written.

## 13. A migration that would have wiped the live data

Before moving tokens off `people`, I hypothesised that dropping the column
would rebuild the table and cascade-delete picks and follows. On a scratch
copy the hypothesis was wrong: drizzle-kit uses SQLite's in-place
`DROP COLUMN`. But a change it can't ALTER (a nullability change) does
rebuild the table. Its `PRAGMA foreign_keys=OFF` is a no-op inside the
migrator's transaction, and with `db.ts` turning keys on before migrating,
picks went 2 → 0 and follows 1 → 0. No migration so far rebuilds a table,
so nothing was lost. Keys are now off while migrating, checked with
`foreign_key_check`, then on. A synthetic rebuild in
`spec/migrations.test.ts` guards it, and was seen failing with the old
order. [`585e861`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/585e861)

## 14. More than one device

A timetable lived in one cookie: lost with it, and stuck on the laptop the
export was downloaded on, when "right now" is a phone question. Tokens moved
to a `sessions` table, with one-time device codes (ten minutes, hashed). The
migration carries every existing token across by hand-written `INSERT`
before the column goes. Tested from the `0003` state, and seen failing
without the step. The claim page only reads, because chat apps fetch pasted
links for previews and a GET that spent the code would let the preview use
it. [`2ef9f1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/2ef9f1b)

## 15. Control over who sees you

Since a share code is the permission, `/me/` now shows who has added you,
with Remove. A new code retires the old one, and deleting cascades
everywhere and drops you off friends' open overlays live. A share link
carries the code through sign-up. A test here nearly repeated entry 8's
vacuous pattern (asserting lists were empty without ever seeing them full).
It now asserts both lists name the person first. [`2d2ca1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/2d2ca1c)

## 16. The grid, read by a person

Screenshots, not tests, drove this:

- Blocks truncated to "C…", and details lived in a `title` tooltip that
  touch and keyboard users never see. Each block is now a button opening a
  native popover. [`1669c05`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/1669c05)
- The first cut of narrow-lane labels hid everything below 4.5rem, which at
  a normal laptop width with three people shown stripped every block. It's
  now tiered: prefix first, then the kind only in a clash's sub-lane.
- On a phone the week became one day per screen, starting on today, with
  day links to show there's more to swipe to. Checked at 390×844.
  [`14bd608`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/14bd608)

Deployed after reading the new migrations' SQL for `DROP TABLE` (none). All
CI probes pass live, and the link check is clean.

## 17. Meetings become each person's own

The design from entry 7 had a hole I'd written down as a "limitation": the
newest import of a class set its meetings for everyone holding it, so anyone
could import a crafted file and move a real tute in every friend's overlay.
Entry 12's test race was the same flaw showing. Class identity stays shared;
meetings and dates now belong to the importer. [`34111b8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/34111b8)

drizzle-kit's generated migration (`ADD person_id integer NOT NULL`) passes
on an empty table and is refused on a volume with rows, so it would have
passed CI and crashed the deploy at boot. It had also dropped the cascade.
Wrote `0005` by hand as a rebuild that fans each shared meeting out per
person, and a test from the `0004` state with data, which failed on the
generated SQL first. `weeks.test.ts` now deliberately imports another file's
class with different dates, and a stranger-import test fails if the query
goes back to joining meetings by class alone.

Deployed after reviewing `0005`'s intended `DROP TABLE`s; all probes pass.

Writing the new harness rule ("never let one person's import write rows
another person's view reads") exposed that `courses.title` still breaks it.

## 18. Titles, contrast

- `courses.title` was first-import-wins, breaking the rule the harness had
  just gained. Titles moved onto `picks` from each person's own export.
  drizzle-kit's SQL was valid but would have blanked every title, so `0006`
  got a hand-written `UPDATE`, tested from the `0005` state. [`024c4b8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/024c4b8)
- Ran the full axe rule set by hand in real Chrome (jsdom has contrast off)
  over every page at 1280px and 390px. One failure: today's phone day tab at
  4.05:1. Fixed. Not added to `pnpm check`, since it needs Chrome.
  [`1185f0e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/1185f0e)

## 19. Pause, then the journey through the real UI

> pause for now

> continue

Before the pause, a two-person journey in a real browser (sign-up, upload,
share link, add by typed code, link a phone, popover on a phone, delete)
failed at the phone claiming its device link. After resuming, it turned out
to be the script: `tap` doesn't wait for the form's navigation, so the URL
check ran early and the next `goto` aborted the claim before its cookie
landed. With the navigation awaited, all 14 steps pass. The app was fine.
The lesson went into `CLAUDE.md`.

Pushed and deployed `024c4b8`/`1185f0e`. Confirmed live by matching the
stylesheet hash to the local build, since the deploy output was ambiguous.

## 20. First-time visitors, and an image that wouldn't load

The home page now explains the app with a screenshot, made from made-up
people so nobody's enrolment ends up in a public repo. `/me/` leads with the
import until there are classes. [`1fb0f33`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-brynmtchll/commit/1fb0f33)

The README image first rendered through Astro's runtime optimiser, which
needs sharp: 200 under the test server, 500 on a scratch server from the
same build. It's a raw `<img>` now, guarded by `spec/images.test.ts`. My
first check that the new test could fail was itself vacuous: `git stash`
restored a README with no image. Redone by breaking a copy. Also went into
`CLAUDE.md`.

