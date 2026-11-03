# Helix

AP portal: reporting. Node 18 or later, no dependencies.

## Aged payables report (TS-001)

Exports the aged payables report to CSV and e-mails it to the finance team every Monday at 07:00 UK time.

- `src/agedPayables.js`: groups outstanding invoices by supplier into Current, 1-30, 31-60, 61-90 and Over 90 days past due. Amounts are integers in pence.
- `src/csv.js`: writes the report as CSV (UTF-8 with BOM, CRLF), guarding text cells against spreadsheet formula injection.
- `src/schedule.js`: works out the next Monday 07:00 Europe/London run, across GMT and BST.
- `src/weeklyEmail.js`: `exportAgedPayablesCsv` for an on-demand download, `sendAgedPayablesEmail` for one send, `scheduleWeeklyAgedPayablesEmail` for the weekly job.

The invoice source (`loadInvoices`) and the mail transport (`mailer.send`) are passed in. Recipients come from configuration, for example `parseRecipients(process.env.AP_FINANCE_EMAILS)`. Mail credentials belong in the environment, never in code.

```js
import { parseRecipients, scheduleWeeklyAgedPayablesEmail } from "./src/weeklyEmail.js";

scheduleWeeklyAgedPayablesEmail({
  loadInvoices,                 // async ({ asOf }) => [{ supplierId, supplierName, invoiceNumber, dueDate, outstanding }]
  mailer,                       // { send: async ({ from, to, subject, text, attachments }) => ... }
  recipients: parseRecipients(process.env.AP_FINANCE_EMAILS),
  sender: process.env.AP_REPORT_SENDER,
  audit: (record) => auditLog.write(record),
});
```

## Tests

```
npm test
```
