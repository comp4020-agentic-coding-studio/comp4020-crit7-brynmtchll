import type { APIRoute } from "astro";
import { unfollow } from "../../../lib/friends";
import { currentPerson } from "../../../lib/people";

// A separate route rather than DELETE: HTML forms can only GET and POST.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const form = await request.formData();
  const friendId = Number(form.get("friend"));
  const removed = Number.isInteger(friendId) && unfollow(me, friendId);
  return redirect(removed ? "/friends/?removed=friend#friends" : "/friends/#friends", 303);
};
