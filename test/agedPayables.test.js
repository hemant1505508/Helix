import test from "node:test";
import assert from "node:assert/strict";
import { buildAgedPayables, bucketFor, dayNumber } from "../src/agedPayables.js";

const inv = (supplierId, supplierName, dueDate, outstanding, invoiceNumber = `${supplierId}-${dueDate}`) => ({ supplierId, supplierName, dueDate, outstanding, invoiceNumber });

test("bucket boundaries", () => {
  assert.equal(bucketFor(-5), "current");
  assert.equal(bucketFor(0), "current");
  assert.equal(bucketFor(1), "d1_30");
  assert.equal(bucketFor(30), "d1_30");
  assert.equal(bucketFor(31), "d31_60");
  assert.equal(bucketFor(60), "d31_60");
  assert.equal(bucketFor(61), "d61_90");
  assert.equal(bucketFor(90), "d61_90");
  assert.equal(bucketFor(91), "d90_plus");
});

test("day numbers ignore daylight saving", () => {
  assert.equal(dayNumber("2026-03-30") - dayNumber("2026-03-28"), 2); // across the BST change
  assert.throws(() => dayNumber("2026-02-30"), /Not a real date/);
  assert.throws(() => dayNumber("30/03/2026"), /YYYY-MM-DD/);
});

test("groups by supplier and bucket, with totals", () => {
  const r = buildAgedPayables([
    inv("S2", "Beta Ltd", "2026-11-10", 10000), // not due yet
    inv("S1", "Acme plc", "2026-10-20", 2550), // 14 days
    inv("S1", "Acme plc", "2026-07-01", 100000), // 125 days
    inv("S1", "Acme plc", "2026-09-01", -500), // credit note, 63 days
    inv("S2", "Beta Ltd", "2026-09-20", 0), // paid: left out
  ], { asOf: "2026-11-03" });

  assert.equal(r.invoiceCount, 4);
  assert.deepEqual(r.rows.map((x) => x.supplierId), ["S1", "S2"]);
  assert.deepEqual(r.rows[0].buckets, { current: 0, d1_30: 2550, d31_60: 0, d61_90: -500, d90_plus: 100000 });
  assert.equal(r.rows[0].total, 102050);
  assert.deepEqual(r.rows[1].buckets, { current: 10000, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });
  assert.deepEqual(r.totals, { buckets: { current: 10000, d1_30: 2550, d31_60: 0, d61_90: -500, d90_plus: 100000 }, total: 112050 });
});

test("refuses amounts that are not whole minor units", () => {
  assert.throws(() => buildAgedPayables([inv("S1", "Acme", "2026-10-01", 12.5)], { asOf: "2026-11-03" }), /integer/);
});
