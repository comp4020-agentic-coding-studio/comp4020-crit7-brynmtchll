import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { personByShareCode } from "./people";
import { follows, type Person, people } from "./schema";

export type FollowResult = "added" | "unknown" | "self";

export function follow(me: Person, code: string): FollowResult {
  const friend = personByShareCode(code);
  if (!friend) return "unknown";
  if (friend.id === me.id) return "self";
  // Adding someone twice is harmless: the primary key makes it a no-op.
  db.insert(follows)
    .values({ followerId: me.id, followeeId: friend.id })
    .onConflictDoNothing()
    .run();
  return "added";
}

export function unfollow(me: Person, friendId: number): void {
  db.delete(follows)
    .where(and(eq(follows.followerId, me.id), eq(follows.followeeId, friendId)))
    .run();
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
