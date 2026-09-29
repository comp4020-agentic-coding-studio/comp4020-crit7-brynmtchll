import type { APIRoute } from "astro";
import { claimDeviceLink, rememberPerson } from "../../../lib/people";

// Spend a link code: this device gets its own session for that timetable.
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const claimed = claimDeviceLink(code);
  if (!claimed) return redirect(`/link/?code=${encodeURIComponent(code)}&failed=1`, 303);
  rememberPerson(cookies, claimed.token, url);
  return redirect("/overlay/", 303);
};
