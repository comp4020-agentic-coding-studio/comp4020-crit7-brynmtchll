import type { APIRoute } from "astro";
import { currentPerson, rotateShareCode } from "../../../lib/people";

export const POST: APIRoute = ({ cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/", 303);
  rotateShareCode(me);
  return redirect("/me/?code=new#share", 303);
};
