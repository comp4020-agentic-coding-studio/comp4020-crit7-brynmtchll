import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { LIMITED, guardedLookup } from "./limits";
import { personByShareCode } from "./people";
import { follows, type Person, people } from "./schema";

export type FollowResult = "added" | "unknown" | "self" | "limited";

export function follow(me: Person, code: string, client: string): { result: FollowResult; friend?: Person } {
  const friend = guardedLookup(client, () => personByShareCode(code));
  if (friend === LIMITED) return { result: "limited" };
  if (!friend) return { result: "unknown" };
  if (friend.id === me.id) return { result: "self" };
  // Adding someone twice is harmless: the primary key makes it a no-op.
  db.insert(follows)
    .values({ followerId: me.id, followeeId: friend.id })
    .onConflictDoNothing()
    .run();
  return { result: "added", friend };
}

// Both removals report whether a follow actually went, because only a real
// removal may be undone (see below).
export function unfollow(me: Person, friendId: number): boolean {
  const { changes } = db
    .delete(follows)
    .where(and(eq(follows.followerId, me.id), eq(follows.followeeId, friendId)))
    .run();
  if (changes > 0) remember(me, { kind: "friend", otherId: friendId });
  return changes > 0;
}

export function friendsOf(me: Person): Person[] {
  return db
    .select({ person: people })
    .from(follows)
    .innerJoin(people, eq(people.id, follows.followeeId))
    .where(eq(follows.followerId, me.id))
    .orderBy(asc(follows.createdAt), asc(people.id))
    .all()
    .map((row) => row.person);
}

// The other direction: everyone who has your code and overlays you. Since
// knowing a code is the permission, this list is who can see your week.
export function followersOf(me: Person): Person[] {
  return db
    .select({ person: people })
    .from(follows)
    .innerJoin(people, eq(people.id, follows.followerId))
    .where(eq(follows.followeeId, me.id))
    .orderBy(asc(follows.createdAt), asc(people.id))
    .all()
    .map((row) => row.person);
}

export function removeFollower(me: Person, followerId: number): boolean {
  const { changes } = db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, me.id)))
    .run();
  if (changes > 0) remember(me, { kind: "follower", otherId: followerId });
  return changes > 0;
}

// --- undo ------------------------------------------------------------------
//
// Removing someone is one tap, so it happens straight away and offers an
// undo instead of asking first. Undo re-creates a follow without a share
// code, so it has to be earned: the record is written only when a removal
// really deleted a row, it's keyed by the remover (taken from their session,
// never the request), and it lasts five minutes. Otherwise anyone could post
// a made-up id to "remove" and "undo" their way onto a stranger's week.
// Kept in memory: one machine (fly.toml), and a restart losing an undo is
// harmless.

export type Removal = { kind: "friend" | "follower"; otherId: number };

const UNDO_MS = 5 * 60 * 1000;
const removals = new Map<number, Removal & { at: number }>();

function remember(me: Person, removal: Removal): void {
  removals.set(me.id, { ...removal, at: Date.now() });
}

export function recentRemoval(me: Person, now = Date.now()): (Removal & { other: Person }) | undefined {
  const removal = removals.get(me.id);
  if (!removal || now - removal.at > UNDO_MS) return undefined;
  const other = db.select().from(people).where(eq(people.id, removal.otherId)).get();
  return other ? { kind: removal.kind, otherId: removal.otherId, other } : undefined;
}

export function undoRemoval(me: Person): Removal | undefined {
  const removal = recentRemoval(me);
  if (!removal) return undefined;
  removals.delete(me.id);
  const row =
    removal.kind === "friend"
      ? { followerId: me.id, followeeId: removal.otherId }
      : { followerId: removal.otherId, followeeId: me.id };
  db.insert(follows).values(row).onConflictDoNothing().run();
  return { kind: removal.kind, otherId: removal.otherId };
}
