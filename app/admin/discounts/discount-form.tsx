"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { createDiscount, updateDiscount } from "@/app/admin/discounts/actions";
import { DiscountMultiSelect } from "@/app/admin/discounts/discount-multi-select";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { calculateDiscountApplication, normalizeDiscountFundingStrategy, type DiscountFundingStrategy } from "@/lib/discounts/calculations";
import { formatCurrency } from "@/lib/products/catalog";

type DiscountFormProduct = {
  id: string;
  title: string;
  category: { name: string };
  priceCents: number;
  internalCostCents: number;
};

type DiscountFormDiscount = {
  id: string;
  name: string;
  code: string;
  discountType: string;
  valueBps: number;
  amountCents: number;
  minSubtotalCents: number;
  ownerProtectedProfitCents: number;
  affectsCommissions: boolean;
  fundingStrategy?: string;
  productIds: string[];
  categoryNames: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  active: boolean;
};

function dateValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function cents(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function percent(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

function buildProductProfitPreview({
  products,
  productIds,
  discountType,
  valuePercent,
  amount
}: {
  products: DiscountFormProduct[];
  productIds: string[];
  discountType: string;
  valuePercent: string;
  amount: string;
}) {
  const selectedProducts = productIds.length > 0 ? products.filter((product) => productIds.includes(product.id)) : products;
  const totalPriceCents = selectedProducts.reduce((sum, product) => sum + product.priceCents, 0);
  const valueBps = Math.round(Number(valuePercent || 0) * 100);
  const fixedAmountCents = cents(amount);

  return selectedProducts.map((product) => {
    const rawDiscountCents =
      discountType === "PERCENT"
        ? Math.round((product.priceCents * valueBps) / 10000)
        : totalPriceCents > 0
          ? Math.round((fixedAmountCents * product.priceCents) / totalPriceCents)
          : 0;
    const maxDiscountCents = Math.max(0, product.priceCents - product.internalCostCents);
    const discountCents = Math.max(0, Math.min(rawDiscountCents, maxDiscountCents, product.priceCents));
    const estimatedOwnerProfitCents = Math.max(0, product.priceCents - product.internalCostCents - discountCents);

    return {
      productId: product.id,
      title: product.title,
      priceCents: product.priceCents,
      internalCostCents: product.internalCostCents,
      discountCents,
      estimatedOwnerProfitCents
    };
  });
}

const fundingStrategyOptions: Array<{
  value: DiscountFundingStrategy;
  label: string;
  description: string;
}> = [
  {
    value: "ORIGINATOR_FUNDED",
    label: "Originator funded",
    description: "Best default. The seller, manager, leader, or partner who uses the coupon absorbs it first."
  },
  {
    value: "PARTNER_FUNDED",
    label: "Partner funded",
    description: "Protects sellers and charges the discount against the partner split first."
  },
  {
    value: "COMPANY_FUNDED",
    label: "Company funded",
    description: "Use only for approved corporate promotions. Commissions are not directly reduced by the coupon."
  },
  {
    value: "SHARED_POOL",
    label: "Shared margin pool",
    description: "Recalculates commissions from the discounted margin for neutral storewide campaigns."
  }
];

function PreviewMetric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "green";
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "green" ? "text-emerald-700" : "text-clinic-ink"}`}>{value}</p>
    </div>
  );
}

export function DiscountForm({
  discount,
  products
}: {
  discount?: DiscountFormDiscount;
  products: DiscountFormProduct[];
}) {
  const [discountType, setDiscountType] = useState(discount?.discountType ?? "PERCENT");
  const [valuePercent, setValuePercent] = useState(discount ? percent(discount.valueBps) : "10");
  const [amount, setAmount] = useState(discount ? dollars(discount.amountCents) : "0.00");
  const [productIds, setProductIds] = useState(discount?.productIds ?? []);
  const [fundingStrategy, setFundingStrategy] = useState<DiscountFundingStrategy>(
    normalizeDiscountFundingStrategy(discount?.fundingStrategy, discount?.affectsCommissions ?? true)
  );

  const productProfitPreview = useMemo(
    () => buildProductProfitPreview({ products, productIds, discountType, valuePercent, amount }),
    [amount, discountType, productIds, products, valuePercent]
  );
  const previewTotals = useMemo(
    () =>
      productProfitPreview.reduce(
        (totals, product) => ({
          priceCents: totals.priceCents + product.priceCents,
          internalCostCents: totals.internalCostCents + product.internalCostCents,
          discountCents: totals.discountCents + product.discountCents,
          estimatedOwnerProfitCents: totals.estimatedOwnerProfitCents + product.estimatedOwnerProfitCents
        }),
        { priceCents: 0, internalCostCents: 0, discountCents: 0, estimatedOwnerProfitCents: 0 }
      ),
    [productProfitPreview]
  );
  const preview = useMemo(() => {
    return calculateDiscountApplication(
      {
        id: discount?.id ?? "preview",
        name: discount?.name ?? "Preview",
        code: discount?.code ?? "PREVIEW",
        discountType,
        valueBps: Math.round(Number(valuePercent || 0) * 100),
        amountCents: cents(amount),
        minSubtotalCents: 0,
        ownerProtectedProfitCents: 0,
        affectsCommissions: fundingStrategy !== "COMPANY_FUNDED",
        fundingStrategy,
        productIds,
        categoryNames: [],
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        redemptionCount: 0,
        active: true
      },
      products.map((product) => ({
        productId: product.id,
        categoryName: product.category.name,
        priceCents: product.priceCents,
        internalCostCents: product.internalCostCents,
        quantity: 1
      }))
    );
  }, [amount, discount, discountType, fundingStrategy, productIds, products, valuePercent]);

  return (
    <form action={discount ? updateDiscount : createDiscount} className="grid gap-6 p-6">
      {discount ? <input type="hidden" name="discountId" value={discount.id} /> : null}
      <input type="hidden" name="ownerProtectedProfit" value="0.00" />
      <input type="hidden" name="minSubtotal" value="0.00" />

      <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.9fr)_160px_minmax(180px,0.8fr)]">
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Name</span>
          <Input name="name" defaultValue={discount?.name} placeholder="Summer close" required className="mt-2 h-12 rounded-xl bg-white/90" />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Coupon code</span>
          <Input name="code" defaultValue={discount?.code} placeholder="SAVE50" required className="mt-2 h-12 rounded-xl bg-white/90 uppercase" />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Type</span>
          <select
            name="discountType"
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-input bg-white/90 px-3 text-sm font-semibold text-clinic-ink shadow-line"
          >
            <option value="PERCENT">Percent</option>
            <option value="AMOUNT">Fixed amount</option>
          </select>
        </label>
        {discountType === "PERCENT" ? (
          <label className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Discount percent</span>
            <Input name="valuePercent" value={valuePercent} onChange={(event) => setValuePercent(event.target.value)} placeholder="10" className="mt-2 h-12 rounded-xl bg-white/90" />
            <input type="hidden" name="amount" value={amount} />
          </label>
        ) : (
          <label className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Discount amount</span>
            <Input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50.00" className="mt-2 h-12 rounded-xl bg-white/90" />
            <input type="hidden" name="valuePercent" value={valuePercent} />
          </label>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_180px_180px]">
        <div className="min-w-0">
          <DiscountMultiSelect
            name="productIds"
            label="Products"
            allLabel="All products"
            value={productIds}
            onChange={setProductIds}
            options={products.map((product) => ({
              value: product.id,
              label: product.title
            }))}
          />
          <span className="mt-2 block text-xs font-medium text-slate-500">Choose specific products, or keep All products selected.</span>
        </div>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Max uses</span>
          <Input name="maxRedemptions" type="number" min="1" defaultValue={discount?.maxRedemptions ?? ""} className="mt-2 h-12 rounded-xl bg-white/90" />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Starts</span>
          <Input name="startsAt" type="date" defaultValue={dateValue(discount?.startsAt ?? null)} className="mt-2 h-12 rounded-xl bg-white/90" />
        </label>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ends</span>
          <Input name="endsAt" type="date" defaultValue={dateValue(discount?.endsAt ?? null)} className="mt-2 h-12 rounded-xl bg-white/90" />
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-line">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Profit by product</p>
              <span
                title="Estimated owner profit is product price minus internal product cost minus the discount. The preview uses one unit of each selected product."
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-clinic-mist text-slate-500"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">1 unit preview</p>
          </div>

          {preview ? (
            <>
              <div className="grid gap-px bg-border sm:grid-cols-4">
                <PreviewMetric label="Revenue" value={formatCurrency(previewTotals.priceCents)} />
                <PreviewMetric label="Discount" value={`-${formatCurrency(previewTotals.discountCents)}`} tone="green" />
                <PreviewMetric label="Cost" value={formatCurrency(previewTotals.internalCostCents)} />
                <PreviewMetric label="Profit" value={formatCurrency(previewTotals.estimatedOwnerProfitCents)} />
              </div>

              <div className="overflow-x-auto">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border bg-clinic-mist/95 text-[11px] uppercase tracking-[0.16em] text-slate-500 backdrop-blur">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 text-right font-semibold">Price</th>
                        <th className="px-4 py-3 text-right font-semibold">Cost</th>
                        <th className="px-4 py-3 text-right font-semibold">Discount</th>
                        <th className="px-5 py-3 text-right font-semibold">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {productProfitPreview.map((product) => (
                        <tr key={product.productId} className="transition hover:bg-clinic-mist/40">
                          <td className="px-5 py-3">
                            <p className="line-clamp-2 font-semibold leading-5 text-clinic-ink">{product.title}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(product.priceCents)}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">{formatCurrency(product.internalCostCents)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">-{formatCurrency(product.discountCents)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-clinic-ink">{formatCurrency(product.estimatedOwnerProfitCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="p-5 text-sm text-slate-500">Select products to preview profit.</p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-clinic-mist/70 p-4">
          <div className="space-y-3">
            <label className="block rounded-xl border border-border bg-white px-4 py-3 shadow-line">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Coupon funding</span>
              <select
                name="fundingStrategy"
                value={fundingStrategy}
                onChange={(event) => setFundingStrategy(normalizeDiscountFundingStrategy(event.target.value))}
                className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-semibold text-clinic-ink"
              >
                {fundingStrategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                {fundingStrategyOptions.find((option) => option.value === fundingStrategy)?.description}
              </p>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-clinic-ink shadow-line">
              <span>Active</span>
              <span className="relative inline-flex h-6 w-11 items-center">
                <input name="active" type="checkbox" defaultChecked={discount?.active ?? true} className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-clinic-navy" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </span>
            </label>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-line">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Formula</p>
            <p className="mt-2 text-sm font-medium leading-6 text-clinic-ink">Price - cost - discount = estimated profit.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-1">
        <SubmitButton variant="accent" pendingText="Saving discount..." className="h-12 min-w-44 rounded-xl">
          {discount ? "Save discount" : "Create discount"}
        </SubmitButton>
      </div>
    </form>
  );
}
