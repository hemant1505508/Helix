import test from "node:test";
import assert from "node:assert/strict";
import { exportAgedPayablesCsv, parseRecipients, sendAgedPayablesEmail } from "../src/weeklyEmail.js";

/** About 12 months of payables: `perMonth` invoices a month spread over `suppliers` suppliers, due dates from a year back to a month ahead. */
function twelveMonths({ asOf = "2026-11-03", suppliers = 2000, perMonth = 25000 } = {}) {
  const end = Date.parse(`${asOf}T00:00:00Z`), out = [];
  for (let i = 0; i < perMonth * 12; i++) {
    const due = new Date(end - 365 * 86_400_000 + ((i * 7919) % 395) * 86_400_000);
    const s = i % suppliers;
    out.push({ supplierId: `S${s}`, supplierName: `Supplier ${s}, Ltd`, invoiceNumber: `INV-${i}`, dueDate: due.toISOString().slice(0, 10), outstanding: ((i * 104729) % 500000) - 20000 });
  }
  return out;
}

test("AC2: the report generates within 10 seconds for 12 months of data", async () => {
  const invoices = twelveMonths(); // 300,000 invoices
  const file = await exportAgedPayablesCsv(async () => invoices, { asOf: "2026-11-03" });
  assert.equal(file.report.rows.length, 2000);
  assert.ok(file.report.invoiceCount > 290000);
  assert.ok(file.ms < 10_000, `took ${file.ms} ms`);
});

test("AC1: the e-mail goes to the finance team with the CSV attached and the UK date as the report date", async () => {
  const sent = [], audits = [];
  const invoices = [{ supplierId: "S1", supplierName: "Acme plc", invoiceNumber: "1", dueDate: "2026-06-01", outstanding: 12345 }];
  let askedFor;
  await sendAgedPayablesEmail({
    loadInvoices: async (q) => { askedFor = q; return invoices; },
    mailer: { send: async (m) => sent.push(m) },
    recipients: ["ap-finance@example.org"],
    sender: "helix-reports@example.org",
    runAt: new Date("2026-11-09T07:00:00Z"),
    audit: (a) => audits.push(a),
  });
  assert.deepEqual(askedFor, { asOf: "2026-11-09" });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ["ap-finance@example.org"]);
  assert.equal(sent[0].subject, "Aged payables report: 2026-11-09");
  assert.equal(sent[0].attachments[0].filename, "aged-payables-2026-11-09.csv");
  assert.match(sent[0].attachments[0].content, /S1,Acme plc,0\.00,0\.00,0\.00,0\.00,123\.45,123\.45/);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].event, "aged_payables.emailed");
  assert.equal(audits[0].recipients, 1);
  assert.ok(!JSON.stringify(audits[0]).includes("Acme"), "the audit record holds no supplier data");
});

test("a failed send is not recorded as sent", async () => {
  const audits = [];
  await assert.rejects(sendAgedPayablesEmail({ loadInvoices: async () => [], mailer: { send: async () => { throw new Error("SMTP refused"); } }, recipients: ["a@example.org"], sender: "b@example.org", audit: (a) => audits.push(a) }), /SMTP refused/);
  assert.equal(audits.length, 0);
});

test("recipients come from configuration and are checked", () => {
  assert.deepEqual(parseRecipients(" ap@example.org, finance.lead@example.org "), ["ap@example.org", "finance.lead@example.org"]);
  assert.throws(() => parseRecipients(""), /No finance team recipients/);
  assert.throws(() => parseRecipients("ap@example.org, not-an-address"), /Not an e-mail address/);
});
