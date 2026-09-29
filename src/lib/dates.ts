// Calendar dates are Canberra's, written "YYYY-MM-DD". Arithmetic on them is
// done at midnight UTC, where days are always 24 hours long, so a daylight-
// saving change (first Sunday in October) can never shift a date.

export type Moment = {
  date: string; // "2026-09-30"
  day: number; // 1 = Monday … 7 = Sunday
  minutes: number; // after midnight
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The clock the app runs on is the campus's, not the server's (Fly runs in
// UTC): "now" is always Canberra time.
export function canberraNow(at: Date = new Date()): Moment {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Canberra",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: WEEKDAYS.indexOf(parts.weekday) + 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const utc = (date: string): Date => new Date(`${date}T00:00:00Z`);
const iso = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export function weekdayOf(date: string): number {
  return utc(date).getUTCDay() || 7;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

// "Mon 28 Sep"
export function formatDate(date: string): string {
  const d = utc(date);
  return `${WEEKDAYS[weekdayOf(date) - 1]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// "35 min", "1 h", "2 h 10 min": how long until something, at a glance.
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
