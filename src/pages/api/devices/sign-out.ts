import type { APIRoute } from "astro";
import { currentPerson, signOut, signOutOtherDevices } from "../../../lib/people";

// "this" forgets the timetable on this device only; "others" keeps this
// device and signs out every other one (a lost phone, a shared computer).
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  if (form.get("which") === "others") {
    const me = currentPerson(cookies);
    if (me) signOutOtherDevices(me, cookies);
    return redirect("/me/?devices=signed-out#devices", 303);
  }
  signOut(cookies);
  return redirect("/", 303);
};
