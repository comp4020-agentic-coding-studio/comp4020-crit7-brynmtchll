import type { APIRoute } from "astro";
import { createPerson, rememberPerson } from "../../lib/people";

// Making a timetable: a name is all it takes. The cookie is set on the
// redirect, so the next page load already knows who you are.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  if (!name) return redirect("/", 303);
  const { token } = createPerson(name);
  rememberPerson(cookies, token, url);
  return redirect("/me/", 303);
};
