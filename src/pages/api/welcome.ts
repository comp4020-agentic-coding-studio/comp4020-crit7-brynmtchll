import type { APIRoute } from "astro";

// Hiding the getting-started checklist is a preference of this device, so
// it's a cookie, not a row: nothing about it needs to follow you.
export const POST: APIRoute = ({ cookies, url, redirect }) => {
  cookies.set("welcome", "hidden", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: 60 * 60 * 24 * 365,
  });
  return redirect("/overlay/", 303);
};
