import type { APIRoute } from "astro";
import { currentPerson, deletePerson } from "../../../lib/people";

// Deleting is permanent and takes every device with it, so the form has to
// say so explicitly: an unticked box sends you back.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const form = await request.formData();
  if (form.get("confirm") !== "yes") return redirect("/me/?delete=unconfirmed#delete", 303);
  deletePerson(me, cookies);
  return redirect("/?deleted=1", 303);
};
