import type { APIRoute } from "astro";
import { follow } from "../../../lib/friends";
import { currentPerson } from "../../../lib/people";

// Add a friend by their share code; the outcome rides back on the redirect
// so /me/ can say what happened without any client-side JavaScript.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const form = await request.formData();
  const result = follow(me, String(form.get("code") ?? ""));
  return redirect(`/me/?friend=${result}#friends`, 303);
};
