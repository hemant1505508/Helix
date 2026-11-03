// CSV writing (RFC 4180) that is safe to open in a spreadsheet.
//
// Text cells that start with = + - @ or a tab/carriage return are prefixed with an apostrophe so a
// spreadsheet does not run them as a formula (CSV injection, OWASP). Numbers are written as they are,
// so a negative amount stays a number.

import { BUCKETS } from "./agedPayables.js";

const FORMULA_START = /^[=+\-@\t\r]/;

export function textCell(value) {
  let s = String(value ?? "");
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minor units (pence) to a plain decimal string: 123456 -> "1234.56", -5 -> "-0.05". */
export function moneyCell(minor) {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * The aged payables report as CSV text: a header, one line per supplier and a totals line.
 * Starts with a UTF-8 byte order mark so Excel reads supplier names with accents or "£" correctly.
 */
export function agedPayablesToCsv(report) {
  const header = ["Supplier ID", "Supplier name", ...BUCKETS.map((b) => b.label), "Total"];
  const lines = [header.map(textCell).join(",")];
  for (const r of report.rows) {
    lines.push([textCell(r.supplierId), textCell(r.supplierName), ...BUCKETS.map((b) => moneyCell(r.buckets[b.key])), moneyCell(r.total)].join(","));
  }
  lines.push(["", textCell("Total"), ...BUCKETS.map((b) => moneyCell(report.totals.buckets[b.key])), moneyCell(report.totals.total)].join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const csvFilename = (asOf) => `aged-payables-${asOf}.csv`;
