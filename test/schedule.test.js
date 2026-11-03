import test from "node:test";
import assert from "node:assert/strict";
import { localDate, nextRun, startWeekly } from "../src/schedule.js";

const iso = (d) => d.toISOString();

test("next run is Monday 07:00 UK time in winter (GMT)", () => {
  assert.equal(iso(nextRun(new Date("2026-11-03T10:00:00Z"))), "2026-11-09T07:00:00.000Z"); // Tuesday
  assert.equal(iso(nextRun(new Date("2026-11-09T06:59:00Z"))), "2026-11-09T07:00:00.000Z"); // Monday, before 07:00
  assert.equal(iso(nextRun(new Date("2026-11-09T07:00:00Z"))), "2026-11-16T07:00:00.000Z"); // exactly at the run: the next one
});

test("next run follows the clocks in summer (BST) and across the changes", () => {
  assert.equal(iso(nextRun(new Date("2026-06-10T12:00:00Z"))), "2026-06-15T06:00:00.000Z"); // 07:00 BST
  assert.equal(iso(nextRun(new Date("2026-03-28T12:00:00Z"))), "2026-03-30T06:00:00.000Z"); // clocks go forward on Sunday 29 March
  assert.equal(iso(nextRun(new Date("2026-10-24T12:00:00Z"))), "2026-10-26T07:00:00.000Z"); // clocks go back on Sunday 25 October
});

test("Sunday night UTC that is already Monday in the UK", () => {
  assert.equal(iso(nextRun(new Date("2026-06-14T23:30:00Z"))), "2026-06-15T06:00:00.000Z"); // 00:30 BST on Monday
  assert.equal(localDate(new Date("2026-06-14T23:30:00Z")), "2026-06-15");
});

test("a different time can be configured", () => {
  assert.equal(iso(nextRun(new Date("2026-11-03T10:00:00Z"), { hour: 8, minute: 30 })), "2026-11-09T08:30:00.000Z");
});

test("startWeekly runs the job at each Monday and keeps going after a failure", async () => {
  let clock = new Date("2026-11-03T10:00:00Z");
  const timers = [], runs = [], errors = [];
  const handle = startWeekly(async (runAt) => { runs.push(iso(runAt)); if (runs.length === 1) throw new Error("mail down"); }, {
    now: () => clock,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
    onError: (e) => errors.push(e.message),
  });
  assert.equal(timers[0].ms, new Date("2026-11-09T07:00:00Z") - clock);
  clock = new Date("2026-11-09T07:00:00Z"); await timers[0].fn();
  clock = new Date("2026-11-16T07:00:00Z"); await timers[1].fn();
  assert.deepEqual(runs, ["2026-11-09T07:00:00.000Z", "2026-11-16T07:00:00.000Z"]);
  assert.deepEqual(errors, ["mail down"]);
  handle.stop();
  assert.equal(timers.length, 3);
});
