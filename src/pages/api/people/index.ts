import type { APIRoute } from "astro";
import { cleanName, createPerson, normaliseShareCode, rememberPerson } from "../../../lib/people";

// Making a timetable: a name is all it takes. The cookie is set on the
// redirect, so the next page load already knows who you are. Arriving from
// a friend's share link carries their code through, so the next page can
// offer to add them.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const form = await request.formData();
  const name = cleanName(String(form.get("name") ?? ""));
  const add = normaliseShareCode(String(form.get("add") ?? ""));
  if (!name) return redirect(add ? `/?add=${add}` : "/", 303);
  const { token } = createPerson(name);
  rememberPerson(cookies, token, url);
  // someone arriving by a friend's link adds them first; anyone else imports
  return redirect(add ? `/friends/?add=${add}` : "/me/", 303);
};
