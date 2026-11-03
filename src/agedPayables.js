// Aged payables: what is owed to each supplier, grouped by how far past the due date it is.
//
// An invoice is { supplierId, supplierName, invoiceNumber, dueDate: "YYYY-MM-DD", outstanding }, where
// `outstanding` is the unpaid amount in minor units (pence) as an integer. Credit notes are negative.
// Amounts are kept as integers throughout so totals never pick up floating-point error.

export const BUCKETS = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1-30 days" },
  { key: "d31_60", label: "31-60 days" },
  { key: "d61_90", label: "61-90 days" },
  { key: "d90_plus", label: "Over 90 days" },
];

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a "YYYY-MM-DD" date, independent of time zone and daylight saving. */
export function dayNumber(isoDate) {
  const m = ISO_DATE.exec(isoDate ?? "");
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (new Date(t).getUTCDate() !== +m[3]) throw new Error(`Not a real date: ${isoDate}`);
  return t / DAY_MS;
}

export function bucketFor(daysPastDue) {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "d1_30";
  if (daysPastDue <= 60) return "d31_60";
  if (daysPastDue <= 90) return "d61_90";
  return "d90_plus";
}

const emptyBuckets = () => Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));

/**
 * Build the report as of `asOf` ("YYYY-MM-DD"). Invoices with nothing outstanding are left out.
 * Returns { asOf, rows: [{ supplierId, supplierName, buckets, total }], totals: { buckets, total }, invoiceCount }.
 * Rows are sorted by supplier name, then id.
 */
export function buildAgedPayables(invoices, { asOf }) {
  const today = dayNumber(asOf);
  const bySupplier = new Map();
  const totals = { buckets: emptyBuckets(), total: 0 };
  let invoiceCount = 0;

  for (const inv of invoices) {
    const amount = inv.outstanding;
    if (!Number.isSafeInteger(amount)) throw new Error(`Invoice ${inv.invoiceNumber}: outstanding must be an integer amount in minor units`);
    if (amount === 0) continue;
    const key = bucketFor(today - dayNumber(inv.dueDate));

    let row = bySupplier.get(inv.supplierId);
    if (!row) {
      row = { supplierId: inv.supplierId, supplierName: inv.supplierName ?? "", buckets: emptyBuckets(), total: 0 };
      bySupplier.set(inv.supplierId, row);
    }
    row.buckets[key] += amount;
    row.total += amount;
    totals.buckets[key] += amount;
    totals.total += amount;
    invoiceCount++;
  }

  const rows = [...bySupplier.values()].sort(
    (a, b) => a.supplierName.localeCompare(b.supplierName, "en-GB") || String(a.supplierId).localeCompare(String(b.supplierId)),
  );
  return { asOf, rows, totals, invoiceCount };
}
