import { EventEmitter } from "node:events";

// One process, one bus: every open SSE connection subscribes here, and a
// change to someone's timetable is broadcast to all of them. This only works
// because the app runs on exactly one machine (see fly.toml) — a second
// machine would have its own bus and clients would miss events.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

// Just who changed, never what: a client that shows that person refetches
// its own page, so the stream carries nothing a stranger shouldn't see.
export type Change = { personId: number };

export function announce(change: Change): void {
  bus.emit("change", change);
}
