"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDollarSign, Info, Link2, Search, ShieldCheck, ShoppingBag, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCurrency } from "@/lib/products/catalog";

type CustomerOption = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lifetimeValueCents: number;
};

type ProductOption = {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  priceCents: number;
  estimatedCommissionCents: number;
  imageUrl: string | null;
  imageAlt: string | null;
  supportsRecurring: boolean;
  supportsSubscription: boolean;
  salesGuide: {
    benefits: string[];
    talkingPoints: string[];
    commonObjections: string[];
    callNotes: string;
  };
};

type RecentOrder = {
  id: string;
  customerName: string;
  totalCents: number;
  commissionCents: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
};

type SalesBuilderClientProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  recentOrders: RecentOrder[];
  canCreateOrders: boolean;
  setupMessage?: string;
  createdOrderId?: string;
  error?: string;
  createOrderAction: (formData: FormData) => void | Promise<void>;
  commissionLabel?: string;
  commissionDetailLabel?: string;
  productEstimateLabel?: string;
  successMessage?: string;
  ownershipCopy?: string;
};

const errorCopy: Record<string, string> = {
  consultant_profile_required: "Your consultant profile is not ready yet.",
  commission_setup_required: "Commission setup must be completed before orders can be created.",
  empty_order: "Select at least one product before creating an order.",
  invalid_customer: "Customer information is incomplete.",
  customer_not_assigned: "That customer is not assigned to your consultant account.",
  invalid_products: "One or more selected products are no longer active.",
  invalid_shipping_address: "Shipping address is required before collecting payment or sending an invoice."
};

const priceRanges = [
  { label: "All prices", min: 0, max: Number.POSITIVE_INFINITY },
  { label: "Under $100", min: 0, max: 10000 },
  { label: "$100-$250", min: 10000, max: 25000 },
  { label: "$250-$500", min: 25000, max: 50000 },
  { label: "$500+", min: 50000, max: Number.POSITIVE_INFINITY }
];

function customerDisplayName(customer: CustomerOption) {
  return customer.name || customer.email;
}

function ProductGuideBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No guide content has been added yet.</p>
      )}
    </div>
  );
}

export function SalesBuilderClient({
  customers,
  products,
  recentOrders,
  canCreateOrders,
  setupMessage,
  createdOrderId,
  error,
  createOrderAction,
  commissionLabel = "Your estimated commission",
  productEstimateLabel = "est. commission",
  successMessage = "Order created successfully. Your commission is pending approval.",
  ownershipCopy = "You can only create orders for customers assigned to you. The operations team can reassign customers when the sales relationship changes."
}: SalesBuilderClientProps) {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(customers.length > 0 ? "existing" : "new");
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? "");
  const [paymentWorkflow, setPaymentWorkflow] = useState<"collect_payment" | "send_invoice">("collect_payment");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState(priceRanges[0].label);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerOpen, setCustomerOpen] = useState(true);
  const [shippingOpen, setShippingOpen] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((product) => product.categoryName))).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const selectedRange = priceRanges.find((range) => range.label === priceRange) ?? priceRanges[0];

    return products.filter((product) => {
      const matchesQuery = !normalized || `${product.title} ${product.categoryName}`.toLowerCase().includes(normalized);
      const matchesCategory = category === "All" || product.categoryName === category;
      const matchesPrice = product.priceCents >= selectedRange.min && product.priceCents < selectedRange.max;
      return matchesQuery && matchesCategory && matchesPrice;
    });
  }, [products, query, category, priceRange]);

  const selectedLines = useMemo(() => {
    return products
      .map((product) => ({
        product,
        quantity: quantities[product.id] ?? 0
      }))
      .filter((line) => line.quantity > 0);
  }, [products, quantities]);

  const subtotalCents = selectedLines.reduce((sum, line) => sum + line.product.priceCents * line.quantity, 0);
  const consultantCommissionCents = selectedLines.reduce(
    (sum, line) => sum + line.product.estimatedCommissionCents * line.quantity,
    0
  );
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedItemCount = selectedLines.reduce((sum, line) => sum + line.quantity, 0);

  function setQuantity(productId: string, value: number) {
    setQuantities((current) => {
      const next = { ...current };
      if (value <= 0) {
        delete next[productId];
      } else {
        next[productId] = value;
      }
      return next;
    });
  }

  return (
    <div className="min-w-0 space-y-6 pb-28 xl:pb-0">
      {createdOrderId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorCopy[error] ?? "Something went wrong while creating the order."}
        </div>
      )}
      {!canCreateOrders && setupMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {setupMessage}
        </div>
      )}

      <form action={createOrderAction} className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
        <input type="hidden" name="customerMode" value={customerMode} />
        <input type="hidden" name="pipelineStage" value="PAYMENT_PENDING" />
        <input type="hidden" name="paymentWorkflow" value={paymentWorkflow} />
        {products.map((product) => (
          <input key={product.id} type="hidden" name={`quantity:${product.id}`} value={quantities[product.id] ?? 0} />
        ))}

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="order-2 min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Customer</p>
                  <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">Assign this sale</h2>
                </div>
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="grid grid-cols-2 rounded-xl bg-clinic-mist p-1">
                    <button
                      type="button"
                      onClick={() => setCustomerMode("existing")}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${customerMode === "existing" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500"}`}
                      disabled={customers.length === 0}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode("new")}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${customerMode === "new" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500"}`}
                    >
                      New
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerOpen((value) => !value)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-clinic-navy shadow-line transition hover:bg-clinic-mist"
                  >
                    {customerOpen ? "Hide details" : "Show details"}
                    <ChevronDown className={`h-4 w-4 transition ${customerOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className={`${customerOpen ? "block" : "hidden"} p-5`}>
              {customerMode === "existing" ? (
                <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Assigned customer</label>
                    <select
                      name="customerId"
                      value={selectedCustomerId}
                      onChange={(event) => setSelectedCustomerId(event.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required={customerMode === "existing"}
                    >
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customerDisplayName(customer)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-xl border border-border bg-clinic-mist p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Customer value</p>
                    <p className="mt-2 text-xl font-semibold text-clinic-navy">
                      {selectedCustomer ? formatCurrency(selectedCustomer.lifetimeValueCents) : "$0.00"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">First name</label>
                    <Input name="firstName" placeholder="First name" className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last name</label>
                    <Input name="lastName" placeholder="Last name" className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</label>
                    <Input name="email" type="email" placeholder="customer@email.com" className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</label>
                    <Input name="phone" placeholder="Phone" className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date of birth</label>
                    <Input name="dateOfBirth" type="date" className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Birth sex</label>
                    <select
                      name="birthSex"
                      className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue=""
                    >
                      <option value="" disabled>Select birth sex</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="order-3 min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Shipping address</p>
                  <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">Delivery details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShippingOpen((value) => !value)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-clinic-navy shadow-line transition hover:bg-clinic-mist"
                >
                  {shippingOpen ? "Hide address" : "Show address"}
                  <ChevronDown className={`h-4 w-4 transition ${shippingOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            <div className={`${shippingOpen ? "grid" : "hidden"} gap-4 p-5 md:grid-cols-2`}>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address line 1</label>
                <Input name="shippingAddressLine1" placeholder="Street address" className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address line 2</label>
                <Input name="shippingAddressLine2" placeholder="Apt, suite, unit, optional" className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">City</label>
                <Input name="shippingCity" placeholder="City" className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">State</label>
                <Input name="shippingState" placeholder="State" className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">ZIP code</label>
                <Input name="shippingPostalCode" placeholder="ZIP code" className="mt-2" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Country</label>
                <Input name="shippingCountry" defaultValue="US" placeholder="Country" className="mt-2" />
              </div>
            </div>
          </Card>

          <Card className="order-1 min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <div className="space-y-5">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Products</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight text-clinic-ink sm:text-3xl">Build the order</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Find the right products, add quantities, and review the order total before collecting payment or sending an invoice.
                  </p>
                </div>
                <div className="grid w-full min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(140px,180px)_minmax(140px,170px)]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." className="pl-9" />
                  </div>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-11 rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select
                    value={priceRange}
                    onChange={(event) => setPriceRange(event.target.value)}
                    className="h-11 rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {priceRanges.map((range) => (
                      <option key={range.label} value={range.label}>{range.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 p-5 md:grid-cols-2">
              {filteredProducts.map((product) => {
                const quantity = quantities[product.id] ?? 0;

                return (
                  <div key={product.id} className={`min-w-0 rounded-2xl border p-3 transition ${quantity > 0 ? "border-clinic-navy bg-blue-50/40" : "border-border bg-white"}`}>
                    <div className="flex gap-3">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-clinic-mist">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.imageAlt ?? product.title} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-clinic-ink">{product.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.categoryName}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {product.supportsRecurring && <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Recurring</Badge>}
                          {product.supportsSubscription && <Badge className="border-red-100 bg-clinic-blush text-clinic-red">Subscription</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p>
                        <p className="text-xs font-semibold text-emerald-700">
                          {formatCurrency(product.estimatedCommissionCents)} {productEstimateLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(product.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-clinic-navy transition hover:bg-clinic-mist"
                          aria-label={`View sales guide for ${product.title}`}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                        <div className="flex items-center rounded-full border border-border bg-white p-1">
                          <button type="button" onClick={() => setQuantity(product.id, quantity - 1)} className="h-8 w-8 rounded-full text-lg font-semibold text-slate-500 hover:bg-clinic-mist">-</button>
                          <input
                            aria-label={`Quantity for ${product.title}`}
                            value={quantity}
                            onChange={(event) => setQuantity(product.id, Number(event.target.value))}
                            className="h-8 w-10 border-0 bg-transparent text-center text-sm font-semibold text-clinic-ink focus:outline-none"
                          />
                          <button type="button" onClick={() => setQuantity(product.id, quantity + 1)} className="h-8 w-8 rounded-full text-lg font-semibold text-clinic-navy hover:bg-clinic-mist">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 xl:sticky xl:top-28 xl:self-start">
          <Card className="min-w-0 rounded-[2rem] border-white/80 bg-white/95 p-4 shadow-[0_18px_46px_rgba(7,55,99,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Live checkout</p>
                <p className="mt-1 text-sm font-semibold text-clinic-ink">
                  {selectedItemCount} item{selectedItemCount === 1 ? "" : "s"} selected
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Pending
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-3xl bg-clinic-mist px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order total</p>
                  <p className="text-xs font-semibold text-slate-500">Live</p>
                </div>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-clinic-navy">{formatCurrency(subtotalCents)}</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{commissionLabel}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800">{formatCurrency(consultantCommissionCents)}</p>
              </div>
            </div>
          </Card>

          <Card className="min-w-0 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-clinic-red" />
              <h2 className="text-lg font-semibold text-clinic-ink">Order summary</h2>
            </div>

            <div className="mt-5 space-y-3">
              {selectedLines.length > 0 ? (
                selectedLines.map((line) => (
                  <div key={line.product.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-clinic-ink">{line.product.title}</p>
                      <p className="mt-1 text-xs text-slate-500">Qty {line.quantity}</p>
                    </div>
                    <p className="font-semibold text-clinic-navy">{formatCurrency(line.product.priceCents * line.quantity)}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-clinic-mist p-4 text-sm text-slate-500">Select products to build the order.</p>
              )}
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-clinic-ink">{formatCurrency(subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment status</span>
                <span className="font-semibold text-clinic-ink">Pending</span>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Payment action</p>
              <div className="mt-2 grid grid-cols-1 gap-2 rounded-2xl bg-clinic-mist p-1 sm:grid-cols-2 xl:grid-cols-1 min-[1800px]:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentWorkflow("collect_payment")}
                  className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-center text-sm font-semibold transition ${
                    paymentWorkflow === "collect_payment" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Collect payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentWorkflow("send_invoice")}
                  className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-center text-sm font-semibold transition ${
                    paymentWorkflow === "send_invoice" ? "bg-white text-clinic-navy shadow-line" : "text-slate-500"
                  }`}
                >
                  <Link2 className="h-4 w-4 shrink-0" />
                  Send invoice
                </button>
              </div>
              <div className="mt-3 break-words rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-clinic-navy">
                {paymentWorkflow === "collect_payment"
                  ? "Opens secure Stripe Checkout after the order is created. Card data is collected by Stripe, not stored in the CRM."
                  : "Creates a Stripe invoice payment link and queues webhook metadata for the communication workflow."}
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order notes</label>
              <textarea
                name="notes"
                placeholder="Add call context, next step, or payment notes..."
                className="mt-2 min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <SubmitButton className="mt-5 w-full" size="lg" pendingText="Creating order..." disabled={!canCreateOrders || selectedLines.length === 0}>
              <CheckCircle2 className="h-4 w-4" />
              {paymentWorkflow === "collect_payment" ? "Collect payment" : "Send invoice"}
            </SubmitButton>
          </Card>

          <Card className="min-w-0 rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-clinic-red" />
              <h2 className="text-lg font-semibold text-clinic-ink">Ownership rule</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {ownershipCopy}
            </p>
          </Card>
        </div>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/92 p-3 shadow-[0_-18px_50px_rgba(7,55,99,0.12)] backdrop-blur-xl lg:left-72 xl:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-[1fr_1fr_auto] items-center gap-2">
          <div className="min-w-0 rounded-2xl bg-clinic-mist px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total</p>
            <p className="truncate text-lg font-semibold text-clinic-navy">{formatCurrency(subtotalCents)}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Commission</p>
            <p className="truncate text-lg font-semibold text-emerald-800">{formatCurrency(consultantCommissionCents)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Items</p>
            <p className="text-lg font-semibold text-clinic-ink">{selectedItemCount}</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <div className="border-b border-border p-5">
          <h2 className="text-lg font-semibold text-clinic-ink">Recent orders</h2>
          <p className="mt-1 text-sm text-slate-500">Your latest manually created sales and commission previews.</p>
        </div>
        <div className="divide-y divide-border">
          {recentOrders.length > 0 ? (
            recentOrders.map((order) => (
              <div key={order.id} className="grid gap-3 p-5 text-sm md:grid-cols-5 md:items-center">
                <div className="md:col-span-2">
                  <p className="font-semibold text-clinic-ink">{order.customerName}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <p className="font-semibold text-clinic-navy">{formatCurrency(order.totalCents)}</p>
                <p className="font-semibold text-emerald-700">{formatCurrency(order.commissionCents)}</p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge>{order.orderStatus}</Badge>
                  <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">{order.paymentStatus}</Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">No orders yet. Create the first pending order above.</p>
          )}
        </div>
      </Card>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div className="flex min-w-0 gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-clinic-mist">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.imageAlt ?? selectedProduct.title} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag className="h-7 w-7 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-clinic-red">Product sales guide</p>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-clinic-ink">{selectedProduct.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedProduct.categoryName} · {formatCurrency(selectedProduct.priceCents)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
                aria-label="Close product guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(92vh-116px)] overflow-y-auto bg-clinic-mist/50 p-5">
              {selectedProduct.description ? (
                <div className="mb-4 rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Overview</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{selectedProduct.description}</p>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <ProductGuideBlock title="Key benefits" items={selectedProduct.salesGuide.benefits} />
                <ProductGuideBlock title="Talking points" items={selectedProduct.salesGuide.talkingPoints} />
                <ProductGuideBlock title="Common objections" items={selectedProduct.salesGuide.commonObjections} />
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Call notes</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedProduct.salesGuide.callNotes || "No call notes have been added yet."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
