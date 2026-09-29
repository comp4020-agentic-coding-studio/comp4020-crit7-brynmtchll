import { createHash, randomBytes, randomInt } from "node:crypto";
import type { AstroCookies } from "astro";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { type Person, people } from "./schema";

// Who you are is a secret token in a cookie; who your friends are is their
// public share code. There are no passwords, so losing the cookie loses the
// timetable — an accepted cost for a prototype with no accounts.
const COOKIE = "timetable";
const YEAR = 60 * 60 * 24 * 365;

// No 0/O, 1/I/L: a share code gets read aloud across a tutorial room.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

function newShareCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normaliseShareCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function createPerson(name: string): { person: Person; token: string } {
  const token = randomBytes(32).toString("base64url");
  // A clash is one in ~900 million per pair; retry rather than reason about it.
  for (;;) {
    try {
      const person = db
        .insert(people)
        .values({ name, shareCode: newShareCode(), tokenHash: hash(token) })
        .returning()
        .get();
      return { person, token };
    } catch (error) {
      if (!String(error).includes("people.share_code")) throw error;
    }
  }
}

export function personByShareCode(code: string): Person | undefined {
  return db
    .select()
    .from(people)
    .where(eq(people.shareCode, normaliseShareCode(code)))
    .get();
}

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const token = cookies.get(COOKIE)?.value;
  if (!token) return undefined;
  return db.select().from(people).where(eq(people.tokenHash, hash(token))).get();
}

export function rememberPerson(cookies: AstroCookies, token: string, url: URL): void {
  cookies.set(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: YEAR,
  });
}
