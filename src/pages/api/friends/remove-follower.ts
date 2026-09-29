import type { APIRoute } from "astro";
import { removeFollower } from "../../../lib/friends";
import { currentPerson } from "../../../lib/people";
import { announce } from "../../../lib/events";

// Stop someone overlaying you. They can add you again only with your code,
// so pair this with a new code if they have it.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const form = await request.formData();
  const followerId = Number(form.get("follower"));
  if (Number.isInteger(followerId)) {
    removeFollower(me, followerId);
    // their open overlay reloads, and you're gone from it
    announce({ personId: me.id });
  }
  return redirect("/me/?follower=removed#visible", 303);
};
