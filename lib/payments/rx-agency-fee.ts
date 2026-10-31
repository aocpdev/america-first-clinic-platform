import Stripe from "stripe";
import { z } from "zod";
import type { AgencyFeeTransaction, Prisma, PrismaClient } from "@prisma/client";
import { assertRxStripeConfiguration, RX_PAYMENT_SOURCE, rxPaymentContractSchema } from "./rx-stripe-policy";

const feeSchema = z.object({
  version: z.literal(1), enabled: z.boolean(), destination: z.string().startsWith("acct_").nullable(),
  feeBps: z.number().int().min(0).max(10000), basis: z.literal("GROSS_MARGIN"),
  sourceAmountCents: z.number().int().nonnegative().safe(), amountCents: z.number().int().nonnegative().safe()
}).strict();
const operationSchema = z.object({
  source: z.literal("rx_agency_fee_v1"), mode: z.enum(["live", "test"]), key: z.string(),
  startedAt: z.string().datetime(), chargeId: z.string().startsWith("ch_"),
  paymentIntentId: z.string().startsWith("pi_"), destination: z.string().startsWith("acct_"),
  transferId: z.string().startsWith("tr_").nullable(), targetCents: z.number().int().positive().safe()
}).strict();
type Config = { mode: "live" | "test"; secretKey?: string; webhookSecret?: string };
export type RxAgencyGateway = {
  charge(paymentIntentId: string, expected: { amountCents: number; orderId: string; companyId: string; customerId: string }): Promise<string>;
  transfer(params: Stripe.TransferCreateParams, key: string): Promise<{ id: string; amount: number; destination: string; sourceCharge: string; livemode: boolean }>;
  reverse(transferId: string, amount: number, key: string): Promise<{ id: string; amount: number; transferId: string }>;
};

function gatewayFor(config: Config): RxAgencyGateway {
  assertRxStripeConfiguration(config);
  const stripe = new Stripe(config.secretKey!, { timeout: 15000, maxNetworkRetries: 1 });
  return {
    charge: async (id, expected) => {
      const intent = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] });
      const charge = intent.latest_charge;
      if (intent.status !== "succeeded" || intent.currency !== "usd" || intent.amount_received !== expected.amountCents ||
        intent.livemode !== (config.mode === "live") || intent.metadata.source !== RX_PAYMENT_SOURCE ||
        intent.metadata.orderId !== expected.orderId || intent.metadata.companyId !== expected.companyId ||
        intent.metadata.customerId !== expected.customerId || !charge) throw new Error("RX_AGENCY_CHARGE_MISMATCH");
      return typeof charge === "string" ? charge : charge.id;
    },
    transfer: async (params, key) => {
      const transfer = await stripe.transfers.create(params, { idempotencyKey: key });
      return { id: transfer.id, amount: transfer.amount, destination: typeof transfer.destination === "string" ? transfer.destination : transfer.destination?.id ?? "",
        sourceCharge: typeof transfer.source_transaction === "string" ? transfer.source_transaction : transfer.source_transaction?.id ?? "", livemode: transfer.livemode };
    },
    reverse: async (transferId, amount, key) => {
      const reversal = await stripe.transfers.createReversal(transferId, { amount }, { idempotencyKey: key });
      return { id: reversal.id, amount: reversal.amount, transferId: typeof reversal.transfer === "string" ? reversal.transfer : reversal.transfer.id };
    }
  };
}

/** Freeze the existing Admin fee settings with this order, before collecting money.
 * Same GROSS_MARGIN formula and destination as the existing agency-fee workflow.
 * No rewrite of historical orders or the legacy payment handler. */
export async function rxAgencyFeeContract(tx: Prisma.TransactionClient, companyId: string, marginCents: number) {
  const setting = await tx.agencyFeeSetting.findUnique({ where: { companyId } });
  if (setting?.isEnabled && (!setting.stripeConnectedAccountId || setting.basis !== "GROSS_MARGIN")) throw new Error("RX_AGENCY_CONFIGURATION_REQUIRED");
  return feeSchema.parse({ version: 1, enabled: setting?.isEnabled ?? false,
    destination: setting?.isEnabled ? setting.stripeConnectedAccountId : null, feeBps: setting?.feeBps ?? 0,
    basis: "GROSS_MARGIN", sourceAmountCents: Math.max(0, marginCents),
    amountCents: setting?.isEnabled ? Math.max(0, Math.round(Math.max(0, marginCents) * setting.feeBps / 10000)) : 0 });
}

/** RX-only durable dispatcher. Intent is committed BEFORE the API call; response and
 * ledger are committed together. Concurrent/replayed events reuse identical parameters
 * and the established agency_fee_* Stripe keys. Network calls never hold a DB lock.
 * Ambiguous operations older than 23 hours stop for reconciliation, never use a new key. */
export async function reconcileRxAgencyFee(db: PrismaClient, orderId: string, config: Config, injectedGateway?: RxAgencyGateway) {
  assertRxStripeConfiguration(config);
  const gateway = injectedGateway ?? gatewayFor(config);
  const scope = await db.order.findUniqueOrThrow({ where: { id: z.string().uuid().parse(orderId) }, select: { companyId: true, customerId: true } });
  const locked = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${scope.customerId}::uuid AND "companyId"=${scope.companyId}::uuid FOR UPDATE`;
    return fn(tx);
  });
  const context = await locked(async tx => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const metadata = order.referralMetadata as Prisma.JsonObject | null;
    const contract = rxPaymentContractSchema.parse(metadata?.rxCheckout);
    const fee = feeSchema.parse(metadata?.rxAgencyFee);
    if (order.referralSource !== RX_PAYMENT_SOURCE || order.paymentProviderCode !== "stripe" ||
      contract.mode !== config.mode || contract.companyId !== scope.companyId || contract.customerId !== scope.customerId || contract.orderId !== orderId ||
      contract.totalCents !== order.totalCents || contract.grossMarginCents !== order.grossMarginCents || fee.sourceAmountCents !== Math.max(0, order.grossMarginCents) ||
      fee.amountCents !== (fee.enabled ? Math.round(fee.sourceAmountCents * fee.feeBps / 10000) : 0)) throw new Error("RX_AGENCY_CONTRACT_MISMATCH");
    const captures = await tx.paymentTransaction.findMany({ where: { orderId, companyId: scope.companyId, status: "CAPTURED" }, take: 2 });
    if (captures.length !== 1 || captures[0].providerCode !== "stripe" || captures[0].amountCents !== order.totalCents ||
      !captures[0].providerTransactionId?.startsWith("pi_")) throw new Error("RX_AGENCY_CAPTURE_REQUIRED");
    if (!fee.enabled || fee.amountCents === 0) {
      await tx.order.update({ where: { id: orderId }, data: { agencyFeeCents: 0, agencyFeeBps: fee.feeBps, agencyFeeStatus: "NOT_APPLICABLE" } });
      return null;
    }
    return { fee, totalCents: order.totalCents, paymentIntentId: captures[0].providerTransactionId };
  });
  if (!context) return;
  const { fee, paymentIntentId, totalCents } = context;
  // Read-only Stripe lookup; no transfer can be created without matching captured funds.
  const chargeId = await gateway.charge(paymentIntentId, { amountCents: totalCents, orderId, ...scope });

  const transfer = await locked(async tx => {
    const rows = await tx.agencyFeeTransaction.findMany({ where: { orderId, type: "TRANSFER" } });
    if (rows.length > 1) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
    if (rows[0]) return rows[0];
    const refunds = await tx.paymentTransaction.aggregate({ where: { orderId, status: "REFUNDED" }, _sum: { amountCents: true } });
    // Do not initiate a new money movement after a refund. An interrupted transfer
    // already has a persisted row and is safely resumed, then reversed below.
    if ((refunds._sum.amountCents ?? 0) > 0) throw new Error("RX_AGENCY_REFUND_BEFORE_TRANSFER_REVIEW_REQUIRED");
    const operation = operationSchema.parse({ source: "rx_agency_fee_v1", mode: config.mode, key: `agency_fee_transfer_${orderId}`,
      startedAt: new Date().toISOString(), chargeId, paymentIntentId, destination: fee.destination, transferId: null, targetCents: fee.amountCents });
    await tx.order.update({ where: { id: orderId }, data: { agencyFeeCents: fee.amountCents, agencyFeeBps: fee.feeBps, agencyFeeStatus: "PENDING" } });
    return tx.agencyFeeTransaction.create({ data: { companyId: scope.companyId, orderId, type: "TRANSFER", amountCents: fee.amountCents,
      feeBps: fee.feeBps, basis: fee.basis, sourceAmountCents: fee.sourceAmountCents, status: "PENDING", rawEvent: operation } });
  });
  const checkOperation = (row: typeof transfer) => {
    const op = operationSchema.parse(row.rawEvent);
    if (row.companyId !== scope.companyId || row.feeBps !== fee.feeBps || row.basis !== fee.basis || row.sourceAmountCents !== fee.sourceAmountCents ||
      op.mode !== config.mode || op.paymentIntentId !== paymentIntentId || op.chargeId !== chargeId || op.destination !== fee.destination) throw new Error("RX_AGENCY_CONTRACT_MISMATCH");
    if (row.status === "PENDING" && Date.now() - Date.parse(op.startedAt) >= 23 * 60 * 60 * 1000) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
    return op;
  };
  const operation = checkOperation(transfer);
  if (operation.key !== `agency_fee_transfer_${orderId}` || operation.targetCents !== fee.amountCents || transfer.amountCents !== fee.amountCents || operation.transferId) throw new Error("RX_AGENCY_CONTRACT_MISMATCH");
  let transferId = transfer.stripeTransferId;
  if (transfer.status === "PENDING") {
    const result = await gateway.transfer({ amount: transfer.amountCents, currency: "usd", destination: operation.destination,
      source_transaction: operation.chargeId, transfer_group: `order_${orderId}`, metadata: { companyId: scope.companyId, orderId,
        paymentIntentId, source: "agency_fee", feeBps: String(fee.feeBps), stripeMode: config.mode } }, operation.key);
    if (!result.id.startsWith("tr_") || result.amount !== transfer.amountCents || result.destination !== operation.destination || result.sourceCharge !== chargeId || result.livemode !== (config.mode === "live")) throw new Error("RX_AGENCY_TRANSFER_MISMATCH");
    await locked(async tx => {
      const current = await tx.agencyFeeTransaction.findUniqueOrThrow({ where: { id: transfer.id } });
      if (current.status === "TRANSFERRED" && current.stripeTransferId === result.id) return;
      if (current.status !== "PENDING") throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
      await tx.agencyFeeTransaction.update({ where: { id: transfer.id }, data: { status: "TRANSFERRED", stripeTransferId: result.id } });
      await tx.order.update({ where: { id: orderId }, data: { agencyFeeStatus: "TRANSFERRED", agencyFeeTransferId: result.id } });
    });
    transferId = result.id;
  } else if (transfer.status !== "TRANSFERRED") throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
  if (!transferId) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");

  // Complete a previously prepared reversal before preparing a newer cumulative one.
  // Bound work per delivery; another provider retry resumes safely if more arrived.
  for (let attempt = 0; attempt < 3; attempt++) {
    const reversal: AgencyFeeTransaction | null = await locked(async (tx): Promise<AgencyFeeTransaction | null> => {
      const rows = await tx.agencyFeeTransaction.findMany({ where: { orderId, type: "REVERSAL" } });
      if (rows.some(row => !["PENDING", "REVERSED"].includes(row.status)) || rows.filter(row => row.status === "PENDING").length > 1) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
      for (const row of rows) checkOperation(row);
      const pending = rows.find(row => row.status === "PENDING");
      if (pending) return pending;
      const refunded = await tx.paymentTransaction.aggregate({ where: { orderId, status: "REFUNDED" }, _sum: { amountCents: true } });
      const refundCents = refunded._sum.amountCents ?? 0;
      if (refundCents < 0 || refundCents > totalCents) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
      const target = Math.min(fee.amountCents, Math.round(fee.amountCents * refundCents / totalCents));
      const reversed = rows.reduce((sum, row) => sum + row.amountCents, 0);
      if (reversed > target) throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
      if (target === reversed) return null;
      return tx.agencyFeeTransaction.create({ data: { companyId: scope.companyId, orderId, type: "REVERSAL", amountCents: target - reversed,
        feeBps: fee.feeBps, basis: fee.basis, sourceAmountCents: fee.sourceAmountCents, stripeTransferId: transferId,
        status: "PENDING", rawEvent: { ...operation, key: `agency_fee_reversal_${orderId}_${target}`, transferId, targetCents: target, startedAt: new Date().toISOString() } } });
    });
    if (!reversal) return;
    const op = checkOperation(reversal);
    if (op.transferId !== transferId || reversal.stripeTransferId !== transferId || op.key !== `agency_fee_reversal_${orderId}_${op.targetCents}` || op.targetCents > fee.amountCents) throw new Error("RX_AGENCY_CONTRACT_MISMATCH");
    const result = await gateway.reverse(transferId, reversal.amountCents, op.key);
    if (!result.id.startsWith("trr_") || result.transferId !== transferId || result.amount !== reversal.amountCents) throw new Error("RX_AGENCY_REVERSAL_MISMATCH");
    await locked(async tx => {
      const current = await tx.agencyFeeTransaction.findUniqueOrThrow({ where: { id: reversal.id } });
      if (current.status === "REVERSED" && current.stripeReversalId === result.id) return;
      if (current.status !== "PENDING") throw new Error("RX_AGENCY_RECONCILIATION_REQUIRED");
      await tx.agencyFeeTransaction.update({ where: { id: reversal.id }, data: { status: "REVERSED", stripeReversalId: result.id } });
      await tx.order.update({ where: { id: orderId }, data: { agencyFeeStatus: op.targetCents === fee.amountCents ? "REVERSED" : "PARTIALLY_REVERSED", agencyFeeReversalId: result.id } });
    });
  }
  throw new Error("RX_AGENCY_RETRY_REQUIRED");
}
