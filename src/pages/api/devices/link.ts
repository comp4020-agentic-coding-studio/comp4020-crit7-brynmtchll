import type { APIRoute } from "astro";
import { createDeviceLink, currentPerson } from "../../../lib/people";

// Make a one-time code for another device. It comes back on the redirect to
// your own /me/ page, which is the only place it's shown.
export const POST: APIRoute = ({ cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  return redirect(`/me/?link=${createDeviceLink(me)}#devices`, 303);
};
