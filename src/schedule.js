// When the weekly report goes out: every Monday morning, UK time (07:00 Europe/London by default),
// correct across the switch between GMT and BST.

export const DEFAULT_SCHEDULE = { weekday: 1, hour: 7, minute: 0, timeZone: "Europe/London" };

const fmtCache = new Map();
function partsIn(timeZone, instant) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(instant).filter((x) => x.type !== "literal").map((x) => [x.type, +x.value]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function offsetMs(timeZone, instant) {
  const p = partsIn(timeZone, instant);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` shows the given local date and time. */
export function zonedTime(timeZone, year, month, day, hour, minute) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  let t = asUtc - offsetMs(timeZone, new Date(asUtc));
  t = asUtc - offsetMs(timeZone, new Date(t)); // second pass in case the guess crossed a clock change
  return new Date(t);
}

/** The local date in `timeZone` as "YYYY-MM-DD". */
export function localDate(instant, timeZone = DEFAULT_SCHEDULE.timeZone) {
  const p = partsIn(timeZone, instant);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** The first scheduled run strictly after `from`. */
export function nextRun(from, schedule = DEFAULT_SCHEDULE) {
  const { weekday, hour, minute, timeZone } = { ...DEFAULT_SCHEDULE, ...schedule };
  const today = partsIn(timeZone, from);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    if (d.getUTCDay() !== weekday) continue;
    const run = zonedTime(timeZone, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute);
    if (run > from) return run;
  }
  throw new Error("No run found in the next 8 days"); // cannot happen for a valid weekday
}

/**
 * Call `job(runAt)` at every scheduled run until the returned `stop()` is called. A failing run is passed to
 * `onError` and does not stop later runs. `now` and `setTimer` can be replaced in tests.
 */
export function startWeekly(job, { schedule = DEFAULT_SCHEDULE, now = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout, onError = console.error } = {}) {
  let timer = null, stopped = false;
  const arm = () => {
    if (stopped) return;
    const runAt = nextRun(now(), schedule);
    timer = setTimer(async () => {
      try { await job(runAt); } catch (e) { onError(e); }
      arm();
    }, Math.max(0, runAt.getTime() - now().getTime()));
  };
  arm();
  return { stop() { stopped = true; if (timer !== null) clearTimer(timer); } };
}
