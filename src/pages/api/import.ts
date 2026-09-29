import type { APIRoute } from "astro";
import { parseMyTimetable } from "../../lib/ical";
import { currentPerson } from "../../lib/people";
import { importTimetable } from "../../lib/timetable";

// A semester's export is tens of kilobytes; anything past this isn't one.
const MAX_BYTES = 2 * 1024 * 1024;

// The MyTimetable export arrives as an uploaded .ics or pasted text, and the
// counts ride back on the redirect so /me/ can say what was kept.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);

  const form = await request.formData();
  const file = form.get("ics");
  const pasted = String(form.get("pasted") ?? "");
  const text = file instanceof File && file.size > 0 ? await file.text() : pasted;
  if (text.length > MAX_BYTES) return redirect("/me/?import=too-big#import", 303);

  const parsed = parseMyTimetable(text);
  if (parsed.classes.length === 0) return redirect("/me/?import=empty#import", 303);

  importTimetable(me, parsed);
  const counts = new URLSearchParams({
    import: "ok",
    classes: String(parsed.classes.length),
    skipped: String(parsed.skipped),
  });
  return redirect(`/me/?${counts}#timetable`, 303);
};
