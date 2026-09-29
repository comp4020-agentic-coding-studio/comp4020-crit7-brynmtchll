import { createHash, randomBytes, randomInt } from "node:crypto";
import type { AstroCookies } from "astro";
import { and, count, eq, gt, lte, ne } from "drizzle-orm";
import { db } from "./db";
import { announce } from "./events";
import { deviceLinks, type Person, people, sessions } from "./schema";

// Who you are is a secret token in a cookie, one per device (a session);
// who your friends are is their public share code. There are no passwords:
// a device that loses its cookie gets the timetable back through a link
// made on another device, or not at all.
const COOKIE = "timetable";
const YEAR = 60 * 60 * 24 * 365;

// No 0/O, 1/I/L: codes get read aloud across a room, or typed off a phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SHARE_CODE_LENGTH = 6;
const LINK_CODE_LENGTH = 8;
const LINK_LIFETIME_MS = 10 * 60 * 1000;

const hash = (secret: string): string => createHash("sha256").update(secret).digest("hex");

function newCode(length: number): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function normaliseShareCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// A new device token for a person, returned once and stored only as a hash.
function startSession(personId: number): string {
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions).values({ tokenHash: hash(token), personId }).run();
  return token;
}

export function createPerson(name: string): { person: Person; token: string } {
  return db.transaction(() => {
    // A share-code clash is one in ~900 million per pair; retry rather than
    // reason about it.
    for (;;) {
      try {
        const person = db.insert(people).values({ name, shareCode: newCode(SHARE_CODE_LENGTH) }).returning().get();
        return { person, token: startSession(person.id) };
      } catch (error) {
        if (!String(error).includes("people.share_code")) throw error;
      }
    }
  });
}

export function personByShareCode(code: string): Person | undefined {
  return db
    .select()
    .from(people)
    .where(eq(people.shareCode, normaliseShareCode(code)))
    .get();
}

const tokenHashOf = (cookies: AstroCookies): string | undefined => {
  const token = cookies.get(COOKIE)?.value;
  return token ? hash(token) : undefined;
};

export function currentPerson(cookies: AstroCookies): Person | undefined {
  const tokenHash = tokenHashOf(cookies);
  if (!tokenHash) return undefined;
  return db
    .select({ person: people })
    .from(sessions)
    .innerJoin(people, eq(people.id, sessions.personId))
    .where(eq(sessions.tokenHash, tokenHash))
    .get()?.person;
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

export function deviceCount(me: Person): number {
  return db.select({ n: count() }).from(sessions).where(eq(sessions.personId, me.id)).get()?.n ?? 0;
}

// --- linking another device ----------------------------------------------

export function formatLinkCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function createDeviceLink(me: Person, now = new Date()): string {
  const code = newCode(LINK_CODE_LENGTH);
  db.transaction((tx) => {
    // expired codes are dead weight; clear them whenever a new one is made
    tx.delete(deviceLinks).where(lte(deviceLinks.expiresAt, now.toISOString())).run();
    tx.insert(deviceLinks)
      .values({
        codeHash: hash(code),
        personId: me.id,
        expiresAt: new Date(now.getTime() + LINK_LIFETIME_MS).toISOString(),
      })
      .run();
  });
  return code;
}

const liveLink = (code: string, now: Date) =>
  and(
    eq(deviceLinks.codeHash, hash(normaliseShareCode(code))),
    gt(deviceLinks.expiresAt, now.toISOString()),
  );

// Whose timetable a code would open, without using it up: the confirm page
// shows this before anything changes, since chat apps fetch pasted links to
// preview them and a GET must never spend the code.
export function peekDeviceLink(code: string, now = new Date()): Person | undefined {
  return db
    .select({ person: people })
    .from(deviceLinks)
    .innerJoin(people, eq(people.id, deviceLinks.personId))
    .where(liveLink(code, now))
    .get()?.person;
}

export function claimDeviceLink(code: string, now = new Date()): { person: Person; token: string } | undefined {
  return db.transaction((tx) => {
    const link = tx.select().from(deviceLinks).where(liveLink(code, now)).get();
    if (!link) return undefined;
    tx.delete(deviceLinks).where(eq(deviceLinks.codeHash, link.codeHash)).run();
    const person = tx.select().from(people).where(eq(people.id, link.personId)).get();
    if (!person) return undefined;
    return { person, token: startSession(person.id) };
  });
}

// --- signing out ------------------------------------------------------------

export function signOut(cookies: AstroCookies): void {
  const tokenHash = tokenHashOf(cookies);
  if (tokenHash) db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
  cookies.delete(COOKIE, { path: "/" });
}

export function signOutOtherDevices(me: Person, cookies: AstroCookies): void {
  const tokenHash = tokenHashOf(cookies);
  if (!tokenHash) return;
  db.delete(sessions)
    .where(and(eq(sessions.personId, me.id), ne(sessions.tokenHash, tokenHash)))
    .run();
}

// --- your code, and yourself ------------------------------------------------

// A new share code stops the old one working for anyone who hasn't used it
// yet. People who already added you keep seeing you; removing them is
// removeFollower's job.
export function rotateShareCode(me: Person): void {
  for (;;) {
    try {
      db.update(people).set({ shareCode: newCode(SHARE_CODE_LENGTH) }).where(eq(people.id, me.id)).run();
      return;
    } catch (error) {
      if (!String(error).includes("people.share_code")) throw error;
    }
  }
}

// Everything about a person goes with them: the foreign keys cascade to
// their sessions, device links, picks, and follows in both directions. The
// shared catalogue rows stay, since they describe ANU's classes, not them.
export function deletePerson(me: Person, cookies: AstroCookies): void {
  db.delete(people).where(eq(people.id, me.id)).run();
  cookies.delete(COOKIE, { path: "/" });
  // anyone overlaying them reloads, and they drop out
  announce({ personId: me.id });
}
