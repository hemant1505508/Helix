import test from "node:test";
import assert from "node:assert/strict";
import { agedPayablesToCsv, csvFilename, moneyCell, textCell } from "../src/csv.js";
import { buildAgedPayables } from "../src/agedPayables.js";

test("money is written from minor units without rounding error", () => {
  assert.equal(moneyCell(0), "0.00");
  assert.equal(moneyCell(5), "0.05");
  assert.equal(moneyCell(123456), "1234.56");
  assert.equal(moneyCell(-5), "-0.05");
  assert.equal(moneyCell(-100000), "-1000.00");
});

test("text cells are quoted and guarded against formulas", () => {
  assert.equal(textCell("Acme plc"), "Acme plc");
  assert.equal(textCell('Smith, "Jones" & Co'), '"Smith, ""Jones"" & Co"');
  assert.equal(textCell("Line\nbreak"), '"Line\nbreak"');
  assert.equal(textCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  assert.equal(textCell("+44 20"), "'+44 20");
  assert.equal(textCell("-1"), "'-1");
  assert.equal(textCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(textCell(null), "");
});

test("the report as CSV", () => {
  const report = buildAgedPayables([
    { supplierId: "S1", supplierName: "Café, Ltd", dueDate: "2026-10-20", outstanding: 2550, invoiceNumber: "1" },
    { supplierId: "S2", supplierName: "=evil()", dueDate: "2026-12-01", outstanding: 100, invoiceNumber: "2" },
  ], { asOf: "2026-11-03" });
  const csv = agedPayablesToCsv(report);
  assert.ok(csv.startsWith("﻿"));
  assert.deepEqual(csv.slice(1).split("\r\n"), [
    "Supplier ID,Supplier name,Current,1-30 days,31-60 days,61-90 days,Over 90 days,Total",
    "S2,'=evil(),1.00,0.00,0.00,0.00,0.00,1.00",
    'S1,"Café, Ltd",0.00,25.50,0.00,0.00,0.00,25.50',
    ",Total,1.00,25.50,0.00,0.00,0.00,26.50",
    "",
  ]);
  assert.equal(csvFilename("2026-11-03"), "aged-payables-2026-11-03.csv");
});
