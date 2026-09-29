import type { APIRoute } from "astro";
import { announce } from "../../../lib/events";
import { undoRemoval } from "../../../lib/friends";
import { currentPerson } from "../../../lib/people";

// Put back the removal you just made, if it's still recent (lib/friends.ts
// says why that's the only thing undo can do).
export const POST: APIRoute = ({ cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  const undone = undoRemoval(me);
  if (!undone) return redirect("/friends/?undone=expired", 303);
  // a follower you'd removed gets your week back on their open overlay
  if (undone.kind === "follower") announce({ personId: me.id });
  return redirect(`/friends/?undone=${undone.kind}${undone.kind === "friend" ? "#friends" : "#visible"}`, 303);
};
