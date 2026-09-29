import type { APIRoute } from "astro";
import { cleanName, currentPerson, renamePerson } from "../../../lib/people";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const form = await request.formData();
  const name = cleanName(String(form.get("name") ?? ""));
  if (!name) return redirect("/me/?renamed=empty#name", 303);
  renamePerson(me, name);
  return redirect("/me/?renamed=1#name", 303);
};
