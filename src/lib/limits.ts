// A share code is the permission to see someone's week, and a device code
// is the permission to be them, so guessing codes has to be slow. Only
// failed lookups count: a person who mistypes a code once loses one try,
// and a script walking the code space runs out fast.
//
// Counts live in memory. That works because the app runs on exactly one
// machine (fly.toml), and a restart forgetting the counts only helps an
// attacker once. Clients are told apart by Fly-Client-IP, which Fly's proxy
// sets on every request; people behind one shared address (campus NAT)
// share an allowance, which 20 failures per 10 minutes leaves plenty of.
// Code spaces, for scale: share codes are 31^6 (~887 million), device
// codes 31^8 and live for ten minutes.

export const MAX_FAILURES = 20;
const WINDOW_MS = 10 * 60 * 1000;

const failures = new Map<string, number[]>();

export function clientOf(request: Request, clientAddress: string | undefined): string {
  return request.headers.get("fly-client-ip") ?? clientAddress ?? "unknown";
}

function recent(client: string, now: number): number[] {
  const kept = (failures.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
  if (kept.length > 0) failures.set(client, kept);
  else failures.delete(client);
  return kept;
}

export const LIMITED = Symbol("limited");

// Run a code lookup on a client's behalf: refused outright once they've
// used up their failures, and counted as a failure if it finds nothing.
export function guardedLookup<T>(client: string, lookup: () => T | undefined, now = Date.now()): T | undefined | typeof LIMITED {
  if (recent(client, now).length >= MAX_FAILURES) return LIMITED;
  const found = lookup();
  if (found === undefined) failures.set(client, [...recent(client, now), now]);
  return found;
}
