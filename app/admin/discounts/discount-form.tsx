"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { createDiscount, updateDiscount } from "@/app/admin/discounts/actions";
import { DiscountMultiSelect } from "@/app/admin/discounts/discount-multi-select";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { calculateDiscountApplication } from "@/lib/discounts/calculations";
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
  const [affectsCommissions, setAffectsCommissions] = useState(discount?.affectsCommissions ?? true);

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
        affectsCommissions,
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
  }, [affectsCommissions, amount, discount, discountType, productIds, products, valuePercent]);

  return (
    <form action={discount ? updateDiscount : createDiscount} className="grid gap-5 p-5">
      {discount ? <input type="hidden" name="discountId" value={discount.id} /> : null}
      <input type="hidden" name="ownerProtectedProfit" value="0.00" />
      <input type="hidden" name="minSubtotal" value="0.00" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Name</span>
          <Input name="name" defaultValue={discount?.name} placeholder="Summer close" required className="mt-2" />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Coupon code</span>
          <Input name="code" defaultValue={discount?.code} placeholder="SAVE50" required className="mt-2 uppercase" />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Type</span>
          <select
            name="discountType"
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line"
          >
            <option value="PERCENT">Percent</option>
            <option value="AMOUNT">Fixed amount</option>
          </select>
        </label>
        {discountType === "PERCENT" ? (
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Discount percent</span>
            <Input name="valuePercent" value={valuePercent} onChange={(event) => setValuePercent(event.target.value)} placeholder="10" className="mt-2" />
            <input type="hidden" name="amount" value={amount} />
          </label>
        ) : (
          <label>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Discount amount</span>
            <Input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="50.00" className="mt-2" />
            <input type="hidden" name="valuePercent" value={valuePercent} />
          </label>
        )}
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Max uses</span>
          <Input name="maxRedemptions" type="number" min="1" defaultValue={discount?.maxRedemptions ?? ""} className="mt-2" />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Starts</span>
          <Input name="startsAt" type="date" defaultValue={dateValue(discount?.startsAt ?? null)} className="mt-2" />
        </label>
        <label>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ends</span>
          <Input name="endsAt" type="date" defaultValue={dateValue(discount?.endsAt ?? null)} className="mt-2" />
        </label>
      </div>

      <div>
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
        <span className="mt-1 block text-xs text-slate-500">Choose one or more products, or keep All products selected.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
            <input
              name="affectsCommissions"
              type="checkbox"
              checked={affectsCommissions}
              onChange={(event) => setAffectsCommissions(event.target.checked)}
            />
            Discount reduces commission pool
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
            <input name="active" type="checkbox" defaultChecked={discount?.active ?? true} />
            Active
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-line">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Estimated owner profit</p>
            <span
              title="Estimated owner profit is product price minus internal product cost minus the discount. The preview uses one unit of each selected product."
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-clinic-mist text-slate-500"
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          </div>
          {preview ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl bg-clinic-mist p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Discount</p>
                  <p className="mt-1 font-semibold text-emerald-700">-{formatCurrency(previewTotals.discountCents)}</p>
                </div>
                <div className="rounded-xl bg-clinic-mist p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Cost</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{formatCurrency(previewTotals.internalCostCents)}</p>
                </div>
                <div className="rounded-xl bg-clinic-mist p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Profit</p>
                  <p className="mt-1 font-semibold text-clinic-ink">{formatCurrency(previewTotals.estimatedOwnerProfitCents)}</p>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-clinic-mist uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Discount</th>
                      <th className="px-3 py-2 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productProfitPreview.map((product) => (
                      <tr key={product.productId}>
                        <td className="px-3 py-2 font-semibold text-clinic-ink">{product.title}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(product.priceCents)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(product.internalCostCents)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">-{formatCurrency(product.discountCents)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-clinic-ink">{formatCurrency(product.estimatedOwnerProfitCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Preview assumes one unit per product. Final order profit is recalculated from the actual cart quantities.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select products to preview profit.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton variant="accent" pendingText="Saving discount...">{discount ? "Save discount" : "Create discount"}</SubmitButton>
      </div>
    </form>
  );
}
