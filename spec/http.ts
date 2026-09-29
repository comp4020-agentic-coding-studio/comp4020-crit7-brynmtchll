import { inject } from "vitest";

// Drive the running app the way a browser would: form POSTs carry a
// same-origin Origin header (Astro's CSRF check refuses them otherwise), and
// who you are is the cookie the app set when you made your timetable.
export const baseUrl = inject("baseUrl");

export type Visitor = { cookie: string; shareCode: string };

// `headers` lets a test be a particular client: the app tells clients
// apart by Fly-Client-IP when it limits code guessing (src/lib/limits.ts).
export function post(
  path: string,
  body: FormData | URLSearchParams,
  cookie = "",
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, cookie, ...headers },
    body,
    redirect: "manual",
  });
}

export async function page(path: string, cookie = "", headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(new URL(path, baseUrl), { headers: { cookie, ...headers } });
  return res.text();
}

export async function makeTimetable(name: string): Promise<Visitor> {
  const res = await post("/api/people", new URLSearchParams({ name }));
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const shareCode = (await page("/me/", cookie)).match(/share-code">([A-Z0-9]+)/)?.[1];
  if (!cookie || !shareCode) throw new Error(`couldn't make a timetable for ${name}`);
  return { cookie, shareCode };
}

export async function importCalendar(visitor: Visitor, ics: string): Promise<Response> {
  const form = new FormData();
  form.set("pasted", ics);
  return post("/api/import", form, visitor.cookie);
}
