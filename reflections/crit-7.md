# Crit 7 reflection

The breakthrough was realising that the MyTimetable export already knew which
weeks each class doesn't run. My first version read the file and kept only its
weekly shape, so the overlay drew every class every week, and "right now" would
have put me in my Monday COMP3320 lecture on Labour Day. The export had left
5 October out. Once the dates were kept, the grid could show a real week,
one-off assessments could appear in the week they happen instead of being
skipped, and the teaching break reads as empty rather than as a normal week.
That is, what I needed had been in the file from the start. I'd designed around
my idea of a timetable rather than the one ANU actually hands you.

This changed how I want to work in two ways. Firstly, I want to ground a design
in the real data before committing to a schema. The same export had already
broken my first schema once (COMP3320 runs LecA and LecB as separate
activities), and both times the fix came from reading the file rather than
reasoning about timetables in general. Secondly, I want to put my effort into
directing and verifying rather than writing. This week I made the decisions,
namely timetabling, the friends overlay, share codes instead of accounts, and
importing the export instead of seeding a catalogue, and the agent built most
of it. The moments that mattered were checks against real behaviour rather than
the code itself, in a real week and a real browser. That's where I want my
effort to go.
