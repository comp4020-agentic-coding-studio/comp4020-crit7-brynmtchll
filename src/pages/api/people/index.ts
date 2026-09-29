import type { APIRoute } from "astro";
import { createPerson, normaliseShareCode, rememberPerson } from "../../../lib/people";

// Making a timetable: a name is all it takes. The cookie is set on the
// redirect, so the next page load already knows who you are. Arriving from
// a friend's share link carries their code through, so the next page can
// offer to add them.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const add = normaliseShareCode(String(form.get("add") ?? ""));
  if (!name) return redirect(add ? `/?add=${add}` : "/", 303);
  const { token } = createPerson(name);
  rememberPerson(cookies, token, url);
  return redirect(add ? `/me/?add=${add}#friends` : "/me/", 303);
};
