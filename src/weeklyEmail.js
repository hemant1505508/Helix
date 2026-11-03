// The weekly aged payables e-mail to the finance team (TS-001, AC1).
//
// The mail transport is passed in (`mailer.send(message)`), so this works with whichever mail service the
// portal uses. Recipients come from configuration, never from code. The audit record holds counts and timings
// only, not supplier names or amounts.

import { buildAgedPayables } from "./agedPayables.js";
import { agedPayablesToCsv, csvFilename } from "./csv.js";
import { DEFAULT_SCHEDULE, localDate, startWeekly } from "./schedule.js";

/** Finance team addresses from a comma-separated setting such as AP_FINANCE_EMAILS. */
export function parseRecipients(value) {
  const list = String(value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) throw new Error("No finance team recipients are configured (AP_FINANCE_EMAILS).");
  for (const a of list) if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(a)) throw new Error(`Not an e-mail address: ${a}`);
  return list;
}

/** The report for `asOf` as a CSV file: { filename, content, report, ms }. */
export async function exportAgedPayablesCsv(loadInvoices, { asOf }) {
  const t0 = performance.now();
  const invoices = await loadInvoices({ asOf });
  const report = buildAgedPayables(invoices, { asOf });
  const content = agedPayablesToCsv(report);
  return { filename: csvFilename(asOf), content, report, ms: Math.round(performance.now() - t0) };
}

/** Build the report as of the run's UK date and e-mail it as a CSV attachment. */
export async function sendAgedPayablesEmail({ loadInvoices, mailer, recipients, sender, runAt = new Date(), timeZone = DEFAULT_SCHEDULE.timeZone, audit = () => {} }) {
  const asOf = localDate(runAt, timeZone);
  const file = await exportAgedPayablesCsv(loadInvoices, { asOf });
  await mailer.send({
    from: sender,
    to: recipients,
    subject: `Aged payables report: ${asOf}`,
    text: `Attached is the aged payables report as of ${asOf}: ${file.report.rows.length} suppliers, ${file.report.invoiceCount} outstanding invoices.`,
    attachments: [{ filename: file.filename, content: file.content, contentType: "text/csv; charset=utf-8" }],
  });
  audit({ event: "aged_payables.emailed", at: new Date().toISOString(), asOf, suppliers: file.report.rows.length, invoices: file.report.invoiceCount, bytes: Buffer.byteLength(file.content), generationMs: file.ms, recipients: recipients.length });
  return file;
}

/** Send the report every Monday morning. Returns { stop }. */
export function scheduleWeeklyAgedPayablesEmail(options, { schedule = DEFAULT_SCHEDULE, ...timerOptions } = {}) {
  return startWeekly((runAt) => sendAgedPayablesEmail({ ...options, runAt, timeZone: schedule.timeZone ?? DEFAULT_SCHEDULE.timeZone }), { schedule, ...timerOptions });
}
