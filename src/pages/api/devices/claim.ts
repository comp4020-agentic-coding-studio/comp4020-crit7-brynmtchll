import type { APIRoute } from "astro";
import { LIMITED, clientOf, guardedLookup } from "../../../lib/limits";
import { claimDeviceLink, rememberPerson } from "../../../lib/people";

// Spend a link code: this device gets its own session for that timetable.
export const POST: APIRoute = async ({ request, cookies, url, redirect, clientAddress }) => {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  const claimed = guardedLookup(clientOf(request, clientAddress), () => claimDeviceLink(code));
  if (claimed === LIMITED) return redirect("/link/?failed=limited", 303);
  if (!claimed) return redirect(`/link/?code=${encodeURIComponent(code)}&failed=1`, 303);
  rememberPerson(cookies, claimed.token, url);
  return redirect("/overlay/", 303);
};
