# Notification and Qualiphy Matrix

This document is the operating map for internal notifications, external webhooks, and the Qualiphy clinical workflow. It should be updated whenever a new workflow changes who needs to be notified, what stage an order moves to, or what external system receives an event.

## Current Notification Matrix

| Workflow | Trigger | Recipients | In-app destination | Current status | Notes |
| --- | --- | --- | --- | --- | --- |
| Agent or group leader registration submitted | A new applicant completes registration under a partner, manager, or leader | Go Virtual Health admins, partner, and direct manager or leader when applicable | Admin/partner approval queue | Implemented | Uses `registration` metadata and removes stale notifications after the application is approved or rejected. |
| Agent approved | Go Virtual Health or partner approves an agent | Agent, direct leader, manager, and partner | Agent dashboard or partner network | Implemented | UI role copy uses Agent for sellers. External webhook still uses `seller.approved` for legacy automation compatibility. |
| Group leader approved | Go Virtual Health or partner approves a group leader | Group leader and partner | Leader dashboard or partner network | Implemented | Recommended next refinement: notify the manager when the group leader was approved under a manager. |
| Application rejected | Go Virtual Health or partner rejects an applicant | Applicant, Go Virtual Health admins, partner, and direct manager or leader when applicable | Approval/network page | Implemented | Includes rejection reason for the applicant. |
| Reward redemption requested | Agent/leader/manager requests a non-cash reward | Go Virtual Health admins | Admin rewards queue | Implemented | Notification resolves after the reward claim is fulfilled. |
| Stripe payment captured | Stripe sends `checkout.session.completed` or `payment_intent.succeeded` | Order hierarchy and Go Virtual Health admins | Orders | Implemented | Moves the order to `NEW_SALE`, sets payment as captured, and creates commission ledger data. |
| Stripe payment failed | Stripe sends `payment_intent.payment_failed` | External webhook only | N/A | Gap | The order is marked failed, but no in-app notification is created yet. Recommended: notify the originator and Go Virtual Health. |
| Stripe refund | Stripe sends `charge.refunded` | No in-app notification | N/A | Gap | The order, commission, and agency fee reversal are updated, but no user-facing notification is created yet. Recommended: notify Go Virtual Health and the order hierarchy. |
| Manual pipeline stage update | Go Virtual Health moves an order to Exam, Medical Review, Approval, Prescription Confirmed, Fulfillment, Shipped, or Deferred | Order hierarchy | Orders | Implemented | Stage notifications include tracking links when available. |
| Manual shipping tracking update | Go Virtual Health updates carrier/tracking on the order | Order hierarchy | Orders | Implemented | Sellers/agents, leaders, managers, and partners can view tracking; editing remains Go Virtual Health controlled. |
| Qualiphy consultation outcome | Qualiphy webhook event `1` | Go Virtual Health admins and order hierarchy | Orders | Implemented | Maps approved to Approval, deferred to Medical Review, rejected/NA to Deferred. |
| Qualiphy prescription confirmation | Qualiphy webhook event `2` | Go Virtual Health admins and order hierarchy | Orders | Implemented | Moves the order to Prescription Confirmed. |
| Qualiphy prescription tracking | Qualiphy webhook event `3` | Go Virtual Health admins and order hierarchy | Orders | Implemented | Stores carrier/tracking and moves the order to Fulfillment. |

## Qualiphy Connection Matrix

| Step | What the app does | File | Current status | Production requirement |
| --- | --- | --- | --- | --- |
| Load exam list | Calls `POST https://api.qualiphy.me/api/exam_list` with `QUALIPHY_API_KEY` and normalizes exam names, IDs, RX type, price, and attachment requirements | `lib/qualiphy/exams.ts` | Implemented | `QUALIPHY_API_KEY` must be configured in Vercel. |
| Show exam selector | Admin pipeline move modal requires selecting either `Do not send to Qualiphy` or a specific Qualiphy exam before moving to Exam | `components/pipeline/customer-pipeline-board.tsx` | Implemented | Exam list must load successfully for live sending. |
| Require patient data | Before sending to Qualiphy, the app requires first name, last name, date of birth, phone, and state | `app/pipeline/actions.ts` | Implemented | Customer records must keep Qualiphy-required fields complete. |
| Send exam invite | Calls `POST https://api.qualiphy.me/api/exam_invite` with patient data, exam ID, state, tele-state, address/shipping data, webhook URL, and `additional_data` | `lib/qualiphy/invites.ts` and `app/pipeline/actions.ts` | Implemented | `publicSiteBaseUrl()` must resolve to the production portal URL so the webhook URL is public. |
| Preserve order link | Sends `additional_data` with `orderId`, `customerId`, `companyId`, and source | `app/pipeline/actions.ts` | Implemented | Qualiphy must echo `additional_data` back in webhook payloads. This is critical. |
| Mark test invites | When Go Virtual Health checks `Send as Qualiphy test`, the invite is marked with `is_test`, `test_mode`, and `environment: test` in `additional_data` and stored in order metadata | `app/pipeline/actions.ts` | Implemented | Use this only with a test customer/order. Qualiphy receives the test flag through `additional_data`. |
| Store invite response | Stores meeting URL, meeting UUID, patient exams, patient exam ID, selected exam, selected user, and sent timestamp in order referral metadata | `app/pipeline/actions.ts` | Implemented | Test one real invite and confirm meeting URL/patient exam ID are saved. |
| Receive consultation webhook | Reads Qualiphy payload, extracts `additional_data.orderId`, saves the raw event, stores exam URL if present, and updates order/customer stage | `app/api/webhooks/qualiphy/route.ts` | Implemented | Qualiphy webhook endpoint must point to `https://portal.govirtualhealth.com/api/webhooks/qualiphy`. |
| Receive prescription webhook | Event `2` updates order to Prescription Confirmed and stores prescription notes/timestamp | `app/api/webhooks/qualiphy/route.ts` | Implemented | Confirm event naming/status from a live Qualiphy test. |
| Receive tracking webhook | Event `3` stores tracking carrier/code and moves order to Fulfillment | `app/api/webhooks/qualiphy/route.ts` | Implemented | Confirm payload fields `tracking_number` and `delivery_service`. |
| Notify correct roles | Qualiphy webhooks notify Go Virtual Health admins plus the full order hierarchy | `app/api/webhooks/qualiphy/route.ts` and `lib/notifications.ts` | Implemented | Test with an order owned by agent, leader, manager, and partner hierarchy. |
| Forward clinical events | Dispatches outbound webhooks for invite sent, consultation complete, prescription confirmed, and prescription tracking | `app/pipeline/actions.ts`, `app/api/webhooks/qualiphy/route.ts`, `components/settings/webhook-settings.tsx` | Implemented | Any GHL or third-party endpoint must subscribe to the clinical events in Settings. |

## Stage Mapping

| Source | Qualiphy status/event | App stage | Business meaning |
| --- | --- | --- | --- |
| Manual | Send to Qualiphy or skip Qualiphy | Exam | The order is ready for clinical exam flow. |
| Qualiphy event `1` | `approved` | Approval | Patient passed the exam; prescription workflow can continue. |
| Qualiphy event `1` | `deferred to medical director` | Medical Review | A clinician needs to review before approval. |
| Qualiphy event `1` | `rejected`, `na`, `n/a`, `not applicable` | Deferred | The order should not continue without manual review/refund handling. |
| Qualiphy event `2` | Any prescription confirmation | Prescription Confirmed | Qualiphy confirmed prescription/treatment eligibility. |
| Qualiphy event `3` | Tracking payload received | Fulfillment | Pharmacy/shipping tracking was received and fulfillment is active. |
| Manual | Shipping completed | Shipped | Product has shipped and commissions can be approved. |

## Required Live Checklist

1. Vercel must have `QUALIPHY_API_KEY` set for production.
2. Vercel must have the public base URL configured so `publicSiteBaseUrl()` resolves to `https://portal.govirtualhealth.com`.
3. Qualiphy must use `https://portal.govirtualhealth.com/api/webhooks/qualiphy` as the inbound webhook URL.
4. Send one test order to Qualiphy with a real exam selection.
5. Confirm the order metadata stores the meeting URL and patient exam ID.
6. Confirm Qualiphy event `1` moves the order to Approval, Medical Review, or Deferred.
7. Confirm event `2` moves the order to Prescription Confirmed.
8. Confirm event `3` stores the tracking code, tracking URL, carrier, and moves the order to Fulfillment.
9. Confirm Go Virtual Health admins, partner, manager, leader, and agent receive only the notifications relevant to that order.

## Verification Notes

- Local API connectivity check passed: `POST https://api.qualiphy.me/api/exam_list` returned HTTP `200` with `167` exams using the local `QUALIPHY_API_KEY`.
- End-to-end production verification still requires sending one real Qualiphy invite from the production app and confirming Qualiphy posts webhook events back to the production webhook URL.
- The pipeline now exposes Qualiphy invite details for Go Virtual Health inside the opportunity modal clinical tab: selected exam, test badge, meeting link, meeting UUID, patient exam ID, last status, last webhook time, and event count.

## Qualiphy Test Procedure

1. Create or use a clearly fake customer/order with complete Qualiphy-required data: first name, last name, phone, date of birth, birth sex, state, and shipping address.
2. In Admin Pipeline, move the opportunity to `Exam`.
3. Choose `Send to Qualiphy`.
4. Select the test exam or the exam template Qualiphy recommends for testing.
5. Check `Send as Qualiphy test`.
6. Submit the move.
7. Open the opportunity modal and go to `RX / Exam`.
8. Confirm the Qualiphy workflow card shows `Test`, meeting link, patient exam ID, and pending status.
9. Open the meeting link and complete the test process if Qualiphy requires it.
10. Confirm webhook events update the same Qualiphy card and move stages through Medical Review, Approval, Prescription Confirmed, or Fulfillment.

## Recommended Next Fixes

1. Add in-app notifications for Stripe payment failures.
2. Add in-app notifications for Stripe refunds and commission rejection.
3. Notify the manager when a group leader is approved under that manager.
4. Add a webhook verification mechanism for Qualiphy if Qualiphy supports a shared secret, header token, or signed payload.
5. Add a small admin-only Qualiphy event timeline inside the order document so Go Virtual Health can see raw event history without opening database metadata.
