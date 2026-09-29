# COMP4020 — Timetable overlay (C7)

This repo is a **full-stack app that overlays friends' ANU timetables**, built
for crit 7 ("Build the ANU system you wish existed"). The **deployed app is what
gets checked**: it has to load at `https://comp4020-crit7-brynmtchll.fly.dev/`
by the cutoff (Wed 30 Sep, 08:30), and the tutor verifies what's deployed
against the published spec at the crit, not this repo and not "it works on my
machine".

The stack is the crit 7 starter, kept on purpose: Astro server output on the
Node adapter, Drizzle over SQLite on a Fly volume, and a server-sent-events
stream. The spec harness and tutor support are built around it, and with a
one-day build a stack change was all cost. What the starter fixes is explained
where it lives: `fly.toml`, the `Dockerfile`, `src/lib/db.ts`, the CI workflow
and `spec/README.md`. This file is only the rules I hold the agent to and the
things it keeps getting wrong.

The brief and spec are on the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/07-anu-system/).
Read both before planning or building.

## My rules

- Be terse, skip long explanations unless asked
- Flag trade-offs briefly rather than writing essays
- Tell me directly if a request conflicts with an earlier constraint
- Don't ask for permissions for standard commands and testing
- When asked to come up with ideas, think deeply and explore a wide array of
  inspirations in order to come up with novel and interesting ideas
- **Meticulousness and precision, over volume.** A shorter page that is exactly
  right beats a longer one that is roughly right.
- **No AI slop prose in anything published.** `README.md` is served at
  `/readme/` and read by the marker, and the UI copy is read by every user.
  Both follow the voice section below.

## The app: what the data dictates

**The MyTimetable export is the only source of timetable data.** Allocate+
exports an `.ics` of every dated occurrence of the classes a student holds.
It has only _their_ groups, which is why there's no seeded catalogue: the
catalogue grows from imports, and two people holding the same class row is
what "you share a class" means. Never seed courses or invent class times.

**The schema follows Allocate+, not intuition.** Real exports showed the
first schema wrong, so hold these:

- A class is (course, **activity code**, group). `LecA` and `LecB` are
  separate activities that can both be group `01`. The kind ("Lecture") is
  derived for display, never a key.
- `02-P1` and `02-P2` are two parts of group `02`: one class, two meetings.
- A room can be absent (`NA`), so it's null.
- **Keep the dates.** A slot doesn't run every week: the export leaves out the
  teaching break and public holidays (no Monday lecture on Labour Day), and a
  one-off session is a meeting with a single date. "This week" and "right
  now" go by `occurrences`, never by the weekly shape alone. A meeting with no
  dates predates the table and is read as weekly.

**Classes are shared; everything read off an export is not.** A class row
(course, activity, group) is shared, and that's what "you share a class"
means. Its meetings, dates and the course's title belong to the person whose
export they came from (`meetings.person_id`, `picks.course_title`). Never
let one person's import write rows another person's view reads.

**Never commit a personal export.** The repo goes public at the cutoff.
Fixtures use COMP4020's classes (every student in the course has them) or
synthetic courses built with `spec/fixtures/mytimetable.ts`.

**Code lookups go through `guardedLookup`.** A share code is a permission
and a device code is an identity, so every lookup by code (adding a friend,
a share link, a device link, and the GETs that name a code's owner) is
limited to 20 failures per client per 10 minutes (`src/lib/limits.ts`).
Clients are told apart by `Fly-Client-IP`, which is only safe because Fly's
proxy overwrites a client-sent one. Re-check that if anything is ever put
in front of Fly.

**A GET never spends anything.** Chat apps fetch pasted links to preview
them, so a link that changes state on GET (claiming a device code, adding a
friend) gets used by the preview. Show a confirm page, and change state on
the POST.

**The live stream says who, never what.** `/api/events` is public, so an event
carries a person id and nothing else. Clients refetch their own page.

**Campus time is Australia/Canberra.** Fly's machines run on UTC. Anything
about "now" goes through `canberraNow()`.

**Keep the process log as we go.** `docs/process-log.md` records my prompts
verbatim, typos included, since paraphrase destroys their value as evidence.
Each prompt gets an annotation written at the time, saying what happened and
which commit it produced. Add an entry whenever a decision is made or
reversed, or a problem is found, but not for routine edits. Reversals and
corrections are the most valuable entries, so never tidy them out.
`PROCESS.md` is drawn from this later, so the log is raw material and not a
draft of it.

## Voice — write like me, not like an assistant

Derived from: `Recurrent_Interface_Network_for_Single_Image_Generation.pdf`
(COMP4528, sections 1-3), `comp4620 Assignment 1.pdf` (Aug 2025), `COMP4620
Assignment 2.pdf` (Oct 2025). The comp3320 report is **not** a source and its
patterns were deliberately removed: bolded claim-sentences and one-word
paragraph fragments came from there, and they are not mine.

Any prose written for me follows these: `README.md`, the UI copy, and
anything drafted towards `PROCESS.md`.

### Sentence shape

- **Flowing prose paragraphs, not bullet fragments.** My paragraphs run several
  sentences and carry the argument. Bullets are for enumerated items
  (parameters, metrics, list of cases), not for chopping up reasoning.
- **Open sentences with the connective.** This is the most distinctive habit:
  "Intuitively, shorter horizons... converge faster". "Conversely, when γ ≥ 1".
  "Thus for any state". "Hence with a linear increase in the number of
  obstacles". "In contrast, for fixed altitudes". "Regarding shortcomings in
  the planner design". "Experimentally, the UCT constant". "Overall,
  performance decreases as the action space increases."
- **Restate precisely with "That is," or "That is to say,".** "This suggests a
  greater presence of narrow passages, denoting a lower ε value, that is, a
  reduced field of view through the obstacles." Used to sharpen a claim
  immediately after making it.
- **Attach reasons inline** with `since`, `as`, `due to`, `given that`,
  `as such`. "since values that are farther apart influence one another less".
- **Contractions are fine in formal writing.** I write "it's expected",
  "doesn't require". Don't formalise them out.
- **`i.e.` and `e.g.` inline**, not "that is to say" spelled out every time.
- **Bold is a label, not an assertion.** I bold a defined term and then define
  it: "**State space.** The state space S = ...", "**Reward function.** The
  reward structure encourages...", "**Pre-processing.**" Never bold a claim
  mid-paragraph for emphasis.
- **Short answer first, then the reasoning** — but only when answering a posed
  question: "Yes. One such example of this is...", "Well suited. We can
  superimpose...". Not as a prose device.

### Intellectual habits

- **Own design decisions in the first person.** "I've chosen the Single-query
  Bi-directional... planner for my design." "for my approximate online solver
  I've designed a Factored Value Monte Carlo Tree Search." "I introduced a goal
  distance heuristic." "I employed the strategy of multi step steering."
- **Mark speculation as speculation, plainly.** "I hypothesize that this leads
  to faster convergence of the two trees." "Perhaps the difficulties mentioned
  above could be further combated if, say, various different targets in the
  opposing tree were selected." The `if, say,` construction is mine.
- **State anomalies bluntly and refuse to explain them away.** "the SIFID
  scores reported are better than the current SOTA by an unreasonably large
  margin... and so are likely erroneous. I was unable to determine a cause of
  error." "seem good beyond reason, and so are included for completeness but
  not considered in the performance evaluation of my model." This is the single
  most characteristic thing in my writing. Never smooth over a result that
  doesn't make sense.
- **Name what was omitted, and why.** "This was omitted due to the little
  influence drones have on one another, though it could potentially reduce the
  number of vehicle collisions." "No other rollout heuristics are employed that
  could potentially offset this, such as history heuristics." A limitations
  section lists specific things not done, each with a reason — it does not
  restate the findings.
- **Name the alternative considered and why it lost.** "The alternative
  approach I considered was to minimise the request size in favour of
  efficiency... I chose not to do this as I decided the efficiency increase
  this offered would not be worth the additional processing required."
- **Tie quantitative claims to the actual figure.** "the success rate declines
  from 100% to 27% across 1 to 7 drones for 3 second of PTPS".

### Don't

- **No throat-clearing.** Cut "It's important to note", "It's worth
  considering", "Let's explore", "In this section we will".
- **No section opening that restates its own heading.**
- **No closing paragraph that restates what was just said.** My closing
  sections add material — limitations, what I'd try next — they don't summarise.
- **No inflated vocabulary.** delve, leverage, crucial, vital, pivotal,
  profound, tapestry, landscape, realm, testament, underscore, myriad,
  navigate (figurative), unlock, foster.
- **No hype adverbs.** remarkably, incredibly, surprisingly, fundamentally,
  deeply, truly, simply.
- **No triads for rhythm.** When I list reasons there are two or four of them,
  not a balanced three.
- **No second-person coaching.**
- **Don't gloss terms a competent reader would know.**

### The known off-voice sample

Section 4 (Reflection) of the RIN paper is the one place my own writing goes
padded, and it is a useful negative example: "highlights critical ethical and
practical concerns", "poses significant risks", "Moreover... Finally...", "must
be carefully considered alongside technical innovation". Ethics-and-implications
prose is where the inflation creeps in. Watch for it hardest in exactly those
passages. Here, that's anything about privacy and what the app does with other
people's timetables.

### Two things not derived, decided

- **Spelling is genuinely inconsistent in my sources** — "maximises" and
  "memoise" alongside "discretized", "hypothesize", "centralized", sometimes in
  one document. Since inconsistency on a published site reads as sloppiness
  rather than voice, use **-ise/-isation throughout**, and keep "whilst" and
  "learnt", which are consistent in my writing.
- **Em-dashes are allowed but rare.** I use one occasionally ("centralized
  motion planning—the planner's effort grows not just linearly but often
  exponentially"). Not banned; just not a habitual device, and never as the
  main way a sentence is built.

Read every paragraph back and cut the half that carries no claim.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
  It serves at the root, `http://localhost:4321/`. There's no base path in this
  repo (see the traps below).
- Before you push, run `pnpm check` (typecheck → build → spec). CI runs the same
  thing plus the evidence check, the secret scan and the deploy, and CI is
  skipped entirely while the repo is private. Until ship day, local
  `pnpm check` is the only feedback loop, and it's the faster one anyway.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth)).
  The rendered page is the truth; your mental model of it isn't. The pages
  that matter are signed in. With no `timetable` cookie, `/overlay/`,
  `/friends/` and `/me/` render an empty state, so a screenshot of them
  without one shows nothing about the work. Look at light and dark, at
  1280px and 390px.
- While the repo is private, deploy from a clean checkout of `HEAD` (a
  `git worktree`), not the working folder: `flyctl deploy` uploads whatever
  is on disk, and uncommitted drafts (the README is served at `/readme/`)
  would go live unreviewed.
- While the repo is private, deploy by hand from the repo root with the token
  in `mise.local.toml`:
  `flyctl deploy --remote-only --ha=false -a comp4020-crit7-brynmtchll`. Then
  probe what CI probes: every page answers 200, `/api/events` sends bytes, a
  same-origin form POST isn't a 403, and a cross-site one is. Don't create
  test people on the live database. It's real state on a volume that outlives
  every deploy.
- When a check fails, read its output before changing anything. The failure
  message is the instruction: it names the file, the line, or the contract.
  Treat a red check as authoritative — the app is wrong until the check is
  green, not until you decide it should be.
- Commit when the checks pass. Never commit a red state.

## The interface: patterns I hold it to

- **Colours come from tokens.** Every colour is a custom property on `:root`,
  defined once for light and once for dark in `src/styles.css`. Components
  use the tokens, never raw values. The one exception is `.qr`, which stays
  white so it scans.
- **People's colours are `.person-N` classes** (`personClass(i)` in
  `src/lib/overlay.ts`), in overlay order with you first, and the same
  person has the same colour on every page. Never inline a colour: inline
  styles can't switch with the theme.
- **One primary button per task.** Everything else is secondary. Deletion is
  `.danger-button`, kept apart in a danger zone.
- **Outcomes are notices where they happened.** Use `.notice` with
  `success`/`error`, `role="status"` or `role="alert"`, and a next step when
  there's an obvious one ("See your week").
- **Removing is immediate, with undo.** Don't add an "are you sure?".
  Deletion is the exception, because it can't be undone, and it takes a
  ticked box.
- **Enhancements start hidden.** Copy, Share and the like carry `hidden` and
  only appear when the browser can do them. The page must work without
  JavaScript: forms are plain GET and POST, and the week's Update button
  is there for no-script.
- **Friends and your own data are separate pages.** `/friends/` holds
  anything social (codes, who's on your week, who can see you). `/me/` holds
  your data (classes, import, name, devices, deletion). Signed in, `/` is
  your week.
- **Tests read pages the way a person does.** Use `doc()` and `text()` in
  `spec/http.ts`, and select by headings and labels, not regexes over
  markup, which break on a class name and can pass vacuously.

## The checks (my sensors)

`pnpm check` = `astro check` (types) → `astro build` → `vitest run`. The tests
boot the **built** server (`dist/server/entry.mjs`, what the Dockerfile runs)
with a throwaway database and drive it over HTTP. An early failure stops the
rest, so a broken build hides every spec result behind it.

- **invariants** (shipped): a landmark, one `h1`, a language, a title, a
  viewport, alt text, and an axe pass on every route in `spec/routes.ts`. They
  visit as a stranger, so they only ever see the signed-out pages.
- **readme** (shipped): `/readme/` serves the whole of `README.md`.
- **mine**, each holding one promise:
  - `ical`: the parser, against a verbatim excerpt of a real export and the
    quirks listed above
  - `timetable`: an import survives a reload, and a re-import replaces it
    (spec line 3)
  - `overlay`: a friend added by code is on the grid, "shared" means the same
    group, and the free-time gaps are right
  - `now`: status at fixed moments (including Labour Day), week filtering,
    and Canberra time across the daylight-saving change
  - `weeks`: the grid draws a real week, leaves out skipped classes, and
    shows one-offs only in their own week
  - `live`: an import is announced on the stream, and only by id
  - `signed-in-a11y`: the axe floor on `/me/` and `/overlay/` with data on them
  - `migrations`: from each previous state with data in it, child rows
    survive a table rebuild, cookies survive the move to `sessions`, shared
    meetings fan out to per-person copies, and titles move onto picks
  - `devices`: a one-time code opens a timetable on a second device, and
    each device signs out alone
  - `privacy`: who can see you and removing them, a new code retiring the
    old one, deletion reaching friends' overlays, and a share link carried
    through sign-up
  - `images`: every image on every route loads as a plain file
  - `limits`: too many failed code lookups refuse a client, even for a right
    code, across every place codes are looked up
  - `pages`: where things live: `/` sends a signed-in person to their week,
    the nav marks the current page, old `/me/?add=` links redirect, renaming
  - `week-page`: the getting-started checklist, the empty week, and Right now
    only on the current week
  - `qr`: each QR code draws exactly the link shown beside it
  - `undo`: undo reverses your own real removal, and can't be used to follow
    someone whose code you never had
  - `not-found`: a wrong address is a real 404 inside the app
- **evidence** (`pnpm check:evidence`): the submission gate.
  `reflections/crit-7.md` must exist, the `PROCESS.md` template comment must
  be gone, every citation must resolve to a real commit, and `CLAUDE.md` must
  exist.
- **secrets**: CI runs trufflehog twice (verified secrets, then the course-key
  shape). The local pre-commit hook in `.githooks/` is the one that matters.
  By the time CI sees a key it's already pushed.
- **deploy** (CI, once public): gated on `check`, then probes the live app:
  200, SSE streaming, same-origin POST accepted, cross-site POST refused, and
  internal links.

axe in jsdom has colour contrast switched off and is not the whole of
accessibility. Contrast needs a real browser, so the full axe rule set is run
by hand in headless Chrome. The run covers 13 page states (signed in and out,
after an invite, a removal, an import, with a class's details open), in
light and dark, at 1280px and 390px. The first run found one failure jsdom
couldn't see (today's phone day tab at 4.05:1); after the redesign all 52
were clean. Rerun it after any colour change. Also by hand in a real
browser: page width at 390px (via `scrollWidth`), the QR codes decoded with
a QR reader, and the two-person journey through the UI. None of these are
in `pnpm check`, because they need Chrome. Nothing measures performance.

## Platform traps (the rest is in the starter's comments)

- **The schema is the ground truth.** Edit `src/lib/schema.ts`, run
  `pnpm db:generate`, commit both. Migrations run at boot on the machine that
  holds the volume. Never edit the database by hand.
- **Migrations are frozen once applied anywhere.** `0001` and `0002` were
  applied to the deployed volume on 29 Sep. A change is a new migration, never
  an edit to an old one.
- **`drizzle-kit generate` needs a TTY when a change is ambiguous.** Dropping
  one table or column while adding another makes it ask whether it's a rename,
  and in a non-interactive shell it fails. Split the change into two
  unambiguous generates (add, then drop).
- **Foreign keys are OFF while migrating and ON after**, in
  `src/lib/open-db.ts`. When SQLite can't ALTER a change in place,
  drizzle-kit recreates the table (copy, DROP, rename). Its
  `PRAGMA foreign_keys=OFF` does nothing inside the migrator's transaction,
  so with keys on the DROP cascades. Recreating `people` deleted every pick
  and follow on a scratch copy. Never move the pragma back above `migrate`;
  `spec/migrations.test.ts` fails if you do. Before deploying any migration,
  read its SQL for `DROP TABLE`.
- **One machine, one volume.** The event bus in `src/lib/events.ts` is
  in-process, which only works on one machine. Leave `fly.toml`'s shape alone.
- **Keep `/api/events` streaming.** CI checks it after every deploy.
- **Form POSTs need a same-origin `Origin` header** (Astro's CSRF check). A
  browser sends it; tests must set it (`spec/http.ts` does). Never turn
  `checkOrigin` off, and keep `*.fly.dev` in `allowedDomains`, or every form
  403s in production.
- **Add every new page to `spec/routes.ts`**, or the invariants silently stop
  covering it. If it matters signed in, add it to `signed-in-a11y` too.
- **Pin `?week=` on any overlay request in a test.** The grid defaults to
  the real current week, and fixture dates are fixed, so an unpinned test
  passes the day it's written and fails a week later. (Test files share one
  server and so the class catalogue; that's fine now meetings are
  per-person, and `weeks.test.ts` imports another file's class with
  different dates on purpose to prove it.)
- **drizzle-kit's SQL can pass on an empty table and fail on the live
  volume.** For `meetings.person_id` it generated `ADD ... NOT NULL` with no
  default, which works on a fresh database and is refused on one with rows.
  Every migration gets a test in `spec/migrations.test.ts` that starts from
  the previous migration's state *with data in it*.
- **There's no base path.** The app is served from the root of its `fly.dev`
  host, so root-absolute links (`href="/me/"`) are correct here. This inverts
  A2's rule, where the platform derived `base` and a root-absolute link
  404'd. Don't port the old rule back in.
- **README images are raw `<img src="public/...">`, never `![](...)`.**
  Astro turns a markdown image into a link to its runtime optimiser
  (`/_image`), which needs sharp at runtime and answered 500 on a scratch
  server. `readme.astro` rewrites a raw tag's `public/` path to the static
  file, and GitHub renders both. `spec/images.test.ts` fails on any `/_image`
  src.
- Commit `pnpm-lock.yaml`: CI and the Dockerfile install with
  `--frozen-lockfile`.

## What I've learned (carried forward)

- **A green test suite is not evidence the artefact works.** Tests hold
  contracts. Whether a human can actually use the thing is found by using it,
  and only by using it.
- **Instrument, don't squint at screenshots.** A dev-only probe reporting real
  values beats "does that look right?" every time.
- **A probe must report page coordinates, not component-relative ones.** Off-by-a-header
  is the classic, and it only surfaces once targets get small.
- **`agent-browser console` returns accumulated history across page loads.** A
  warning from deleted code still reads as current. Restart the dev server and
  clear `node_modules/.vite` before believing it.
- **A probe cannot see what a person cannot see.** Scripted checks aim at
  coordinates, so they never notice that a human has no way to tell what they're
  about to click. Instrumentation proves the mechanism works, not that anyone
  can reach it.
- **Sizes belong in relative units, not pixels.** Anything written as a pixel
  constant looks right at one viewport and wrong at another.
- **`every()` on an empty array is `true`, and a lookup that finds nothing
  passes every negative assertion.** Guard the empty case before reading a
  verdict off a fold, and assert that a test's lookup found what it needed
  before asserting that something is absent.
- **When a spec test greps built output, don't quote-match narrowly.** The
  production minifier rewrites string literals as template literals, so a
  `["']` character class reads a working page as broken.
- **A browser script's failure can be the script.** Playwright's `tap` and
  `click` don't wait for the navigation a form submit starts. Checking the
  URL straight after, or navigating away, races the response, and the Set-Cookie
  never lands. Wait for the URL before calling the app broken.
- **Prove a guard fails by breaking the real file, not a stand-in.** A
  `git stash` meant to put back a broken README put back one with no image
  at all, and the test "failed to fail" vacuously. Copy the good file aside,
  break the working copy, run, and restore.
- **Check phone overflow against the width you set, not `innerWidth`.**
  With mobile emulation, the browser widens the layout viewport to fit
  content that overflows, so `scrollWidth > innerWidth` stays false while
  the page is 150px too wide. Compare `scrollWidth` to 390.
- **A visually hidden span can widen the page.** It's `position: absolute`,
  so with no positioned ancestor inside a scroll box it's laid out against
  the page and escapes the box's clipping. Scroll containers get
  `position: relative`.
- **An author `display` rule beats the `hidden` attribute.** Buttons are
  `inline-flex`, which silently overrode `hidden` on every "only when the
  browser can" button. `[hidden] { display: none !important }` is in the
  base styles for that reason; don't remove it.
- **Get real data before designing the schema.** The first schema was
  designed from an idea of what a timetable is, and one real export broke it
  (LecA/LecB, lab parts, rooms that are `NA`). It also showed that the planned
  seeded catalogue couldn't work at all.

## Process is part of the mark

The checks can't see any of this; a person reads it directly.

- **Commit as you go.** Small, frequent commits are the record. A trail that
  grew alongside the work is the strongest evidence; a dump the night before is
  the weakest.
- **`PROCESS.md` is a reading guide**, written by me. For a weekly prototype
  that's a paragraph or two: what I built, the moments that mattered, each
  pointing at a commit, a `CLAUDE.md` change, or a prompt and the commit it
  produced. Markers follow citations and don't trawl for evidence I didn't
  point at.
- **`reflections/crit-7.md`**, 150–300 words, answers the two standing prompts:
  the breakthrough that moved the work forward, and what this work changed
  about the developer I want to be. The cutoff sweep reads that exact
  filename. If it isn't there by 08:30 the week doesn't count as shipped,
  however good the app is.
- **I have to be able to account for the work** (spec line 5): how I directed,
  grounded and corrected it. The process log is where that account comes from.
- **`spec/` is read as process evidence**, not just backpressure: my checks are
  the record of what I decided had to stay true.
- **This file is process evidence too.** Keep it honest and current.

## This file is yours

Carried forward from `comp4020-ass2-BrynMtchll` and corrected against this
repo's actual platform, the crit 7 dynamic starter. A2's course model and its
research-before-outline rule were dropped as dead, and so were the Slop
platform's traps (collections, `course-config.ts`, `published:`,
`pages-base.ts`). The base-path rule was **inverted**, because this app is
served from the root. The platform traps and "the app: what the data dictates"
are new, and come from what went wrong or surprised me building this.

As I learn what this app needs — a convention to hold the agent to, a sensor
that keeps catching me out, a fact the agent keeps getting wrong — it goes here.
