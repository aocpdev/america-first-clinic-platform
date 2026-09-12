# Go Virtual Health — 1099 and direct payout operations

## Operating model

Go Virtual Health is the payer and controls payout approval. Every partner, manager, group leader, and consultant who can earn compensation completes one secure tax-and-payout setup. Approved commission splits are paid directly to that person's verified bank destination; funds are not routed through an upstream partner.

The platform creates the connected payment profile automatically. Recipients do not need to open or operate a separate Stripe business account. Stripe is the regulated processor and vault for full taxpayer and bank data. The CRM stores only the connected-account reference, readiness status, requirement status, bank name, and last four digits.

## Recipient setup

1. The recipient signs in to Go Virtual Health.
2. A persistent banner links to **Profile → Tax and payout setup**.
3. The recipient provides legal identity, W-9 certification, and a US bank destination through the secure processor flow.
4. The platform synchronizes identity/bank requirements and marks the recipient **Ready to receive payments** only after transfers are enabled and no requirements are due.
5. If information later expires or Stripe requests an update, the profile returns to **Action required** and new payouts are blocked.

Go Virtual Health must not add fields that persist full SSN, EIN, routing number, account number, or a signed W-9 in the application database.

## Admin payout procedure

1. Confirm the underlying order payment is captured and the commission split is approved.
2. Open **Admin → Payouts**.
3. Choose **Send to bank** or **Record cash**.
4. For a bank payout, confirm the row shows a verified destination. The platform sends exactly that recipient's approved split using an idempotent transfer.
5. For cash, deliver the funds outside the platform first; **Record cash** records the date, amount, recipient, and administrator but does not move money.
6. Store the payment method and audit record, then mark the split paid.

If the recipient has not finished setup, only the electronic bank option remains blocked. Do not record cash unless the funds were actually delivered. Zero-dollar commission splits are never displayed as payout options and are rejected by the payout action.

## Stripe tax-reporting configuration

Before production tax reporting, an authorized Go Virtual Health administrator and tax adviser should review these settings in the Stripe Dashboard:

- Enable Connect tax reporting for the platform.
- Select **1099-NEC** as the default form for nonemployee compensation when that classification is correct.
- Confirm the calculation method. For this direct-transfer design, **payouts only** is the likely starting point, but it must be validated against Go Virtual Health's books and tax advice.
- Enable electronic delivery and tax-information collection for connected recipients.
- Configure the Go Virtual Health legal name, TIN, address, and support contact exactly as they must appear on forms.
- Reconcile Stripe totals with the general ledger before filing.
- Review missing TINs, name/TIN mismatches, address failures, corrections, state filing obligations, and backup-withholding cases before deadlines.

For payments made in calendar year 2026, IRS instructions currently state a $2,000 federal filing threshold for Form 1099-NEC. State thresholds or other filing duties may differ, and tax rules can change. The platform should retain annual totals for every recipient regardless of whether a form is ultimately required.

## Annual close checklist

- Lock the reporting period and reconcile all transferred, reversed, refunded, failed, and externally paid amounts.
- Confirm recipient legal names, addresses, TIN status, and delivery consent.
- Apply the tax adviser's inclusion/exclusion rules and current federal/state thresholds.
- Review draft forms in Stripe; resolve exceptions and corrections.
- File and deliver forms under Go Virtual Health's payer identity.
- Export and retain the final filing register and supporting payout ledger under the company's retention policy.

This document describes the product workflow and operational controls. It is not tax or legal advice; worker classification, reportable amounts, withholding, and federal/state filing obligations must be approved by Go Virtual Health's qualified tax adviser.
