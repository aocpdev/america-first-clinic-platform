"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Home, Info, Link2, Search, ShieldCheck, ShoppingBag, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { calculateDiscountApplication, isDiscountActive, normalizeDiscountCode } from "@/lib/discounts/calculations";
import { US_STATE_OPTIONS } from "@/lib/locations/us-states";
import { formatPhoneForDisplay } from "@/lib/phone";
import { formatCurrency } from "@/lib/products/catalog";

type CustomerOption = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  lifetimeValueCents: number;
  addresses: CustomerAddressOption[];
};

type CustomerAddressOption = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

type ProductOption = {
  id: string;
  title: string;
  description: string;
  categoryName: string;
  priceCents: number;
  internalCostCents: number;
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

type DiscountOption = {
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
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
};

type SalesBuilderClientProps = {
  customers: CustomerOption[];
  products: ProductOption[];
  discounts?: DiscountOption[];
  canCreateOrders: boolean;
  setupMessage?: string;
  createdOrderId?: string;
  error?: string;
  createOrderAction: (formData: FormData) => void | Promise<void>;
  commissionLabel?: string;
  commissionDetailLabel?: string;
  productEstimateLabel?: string;
  successMessage?: string;
  ownershipCopy?: string | null;
};

const errorCopy: Record<string, string> = {
  consultant_profile_required: "Your consultant profile is not ready yet.",
  commission_setup_required: "Commission setup must be completed before orders can be created.",
  empty_order: "Select at least one product before creating an order.",
  invalid_customer: "Customer information is incomplete.",
  duplicate_customer_contact: "This email or phone already belongs to another customer. Select the existing customer before creating the order.",
  customer_not_assigned: "That customer is not assigned to your consultant account.",
  customer_qualiphy_required: "This customer needs first name, last name, phone, date of birth, birth sex, and state before creating an order.",
  invalid_products: "One or more selected products are no longer active.",
  invalid_shipping_address: "Shipping address is required before collecting payment or sending an invoice.",
  invalid_discount: "That discount code is not active or does not exist.",
  discount_not_applicable: "That discount does not apply to the selected products or cannot protect owner profit."
};

const priceRanges = [
  { label: "All prices", min: 0, max: Number.POSITIVE_INFINITY },
  { label: "Under $100", min: 0, max: 10000 },
  { label: "$100-$250", min: 10000, max: 25000 },
  { label: "$250-$500", min: 25000, max: 50000 },
  { label: "$500+", min: 50000, max: Number.POSITIVE_INFINITY }
];

type SalesDraft = {
  state: {
    customerMode: "existing" | "new";
    selectedCustomerId: string;
    paymentWorkflow: "collect_payment" | "send_invoice";
    query: string;
    customerQuery: string;
    shippingMode: "saved" | "new";
    selectedShippingAddressId: string;
    category: string;
    priceRange: string;
    quantities: Record<string, number>;
    customerOpen: boolean;
    shippingOpen: boolean;
    couponCode: string;
  };
  fields: Record<string, string>;
};

function salesDraftKey() {
  return `afc:sales-builder:${window.location.pathname}`;
}

function customerDisplayName(customer: CustomerOption) {
  return customer.name || customer.email;
}

function customerInitials(customer: CustomerOption) {
  const source = customerDisplayName(customer).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase() || "AF";
}

function addressLabel(address: CustomerAddressOption) {
  return address.isDefault ? "Default address" : "Saved address";
}

function addressSummary(address: CustomerAddressOption) {
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.postalCode}`, address.country]
    .filter(Boolean)
    .join(", ");
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
  discounts = [],
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
  const formRef = useRef<HTMLFormElement>(null);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(customers.length > 0 ? "existing" : "new");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentWorkflow, setPaymentWorkflow] = useState<"collect_payment" | "send_invoice">("collect_payment");
  const [query, setQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [shippingMode, setShippingMode] = useState<"saved" | "new">("new");
  const [selectedShippingAddressId, setSelectedShippingAddressId] = useState("");
  const [category, setCategory] = useState("All");
  const [priceRange, setPriceRange] = useState(priceRanges[0].label);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerOpen, setCustomerOpen] = useState(true);
  const [shippingOpen, setShippingOpen] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

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
  const appliedDiscount = useMemo(() => {
    const code = normalizeDiscountCode(couponCode);
    if (!code || selectedLines.length === 0) return null;

    const discount = discounts.find((item) => normalizeDiscountCode(item.code) === code);
    if (!discount) return null;

    const discountForCalculation = {
      ...discount,
      startsAt: discount.startsAt ? new Date(discount.startsAt) : null,
      endsAt: discount.endsAt ? new Date(discount.endsAt) : null
    };

    if (!isDiscountActive(discountForCalculation)) return null;

    return calculateDiscountApplication(
      discountForCalculation,
      selectedLines.map((line) => ({
        productId: line.product.id,
        categoryName: line.product.categoryName,
        priceCents: line.product.priceCents,
        internalCostCents: line.product.internalCostCents,
        quantity: line.quantity
      }))
    );
  }, [couponCode, discounts, selectedLines]);
  const discountCents = appliedDiscount?.discountCents ?? 0;
  const orderTotalCents = appliedDiscount?.totalCents ?? subtotalCents;
  const originalGrossMarginCents = selectedLines.reduce(
    (sum, line) => sum + Math.max(0, line.product.priceCents - line.product.internalCostCents) * line.quantity,
    0
  );
  const commissionScale =
    appliedDiscount && originalGrossMarginCents > 0
      ? Math.min(1, appliedDiscount.commissionableMarginCents / originalGrossMarginCents)
      : 1;
  const adjustedCommissionCents = Math.max(0, Math.round(consultantCommissionCents * commissionScale));
  const couponEntered = normalizeDiscountCode(couponCode).length > 0;
  const couponInvalid = couponEntered && !appliedDiscount;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedShippingAddress = selectedCustomer?.addresses.find((address) => address.id === selectedShippingAddressId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedItemCount = selectedLines.reduce((sum, line) => sum + line.quantity, 0);

  const matchingCustomers = useMemo(() => {
    const normalized = customerQuery.trim().toLowerCase();
    return customers.filter((customer) => {
      const haystack = [
        customerDisplayName(customer),
        customer.email,
        customer.phone ?? "",
        formatPhoneForDisplay(customer.phone)
      ]
        .join(" ")
        .toLowerCase();

      return !normalized || haystack.includes(normalized);
    });
  }, [customers, customerQuery]);
  const filteredCustomers = matchingCustomers.slice(0, 8);

  useEffect(() => {
    const firstAddress = selectedCustomer?.addresses[0];

    if (customerMode !== "existing" || !firstAddress) {
      setShippingMode("new");
      setSelectedShippingAddressId("");
      return;
    }

    const selectedAddressIsValid = selectedCustomer.addresses.some((address) => address.id === selectedShippingAddressId);
    if (shippingMode === "saved" && !selectedAddressIsValid) {
      setSelectedShippingAddressId(firstAddress.id);
    }
  }, [customerMode, selectedShippingAddressId, selectedCustomer, shippingMode]);

  useEffect(() => {
    if (createdOrderId) {
      localStorage.removeItem(salesDraftKey());
      return;
    }

    if (!error) return;

    const rawDraft = localStorage.getItem(salesDraftKey());
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as SalesDraft;
      setCustomerMode(draft.state.customerMode);
      setSelectedCustomerId(draft.state.selectedCustomerId);
      setPaymentWorkflow(draft.state.paymentWorkflow);
      setQuery(draft.state.query);
      setCustomerQuery(draft.state.customerQuery);
      setShippingMode(draft.state.shippingMode);
      setSelectedShippingAddressId(draft.state.selectedShippingAddressId);
      setCategory(draft.state.category);
      setPriceRange(draft.state.priceRange);
      setQuantities(draft.state.quantities);
      setCustomerOpen(draft.state.customerOpen);
      setShippingOpen(draft.state.shippingOpen);
      setCouponCode(draft.state.couponCode ?? "");

      window.requestAnimationFrame(() => {
        const form = formRef.current;
        if (!form) return;

        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]").forEach((field) => {
          const value = draft.fields[field.name];
          if (typeof value === "undefined") return;

          if (field instanceof HTMLInputElement && field.type === "checkbox") {
            field.checked = value === "true";
            return;
          }

          field.value = value;
        });
      });
    } catch {
      localStorage.removeItem(salesDraftKey());
    }
  }, [createdOrderId, error]);

  function saveSalesDraft() {
    const form = formRef.current;
    const fields: Record<string, string> = {};

    if (form) {
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]").forEach((field) => {
        if (field.name.startsWith("quantity:")) return;

        if (field instanceof HTMLInputElement && field.type === "checkbox") {
          fields[field.name] = field.checked ? "true" : "false";
          return;
        }

        fields[field.name] = field.value;
      });
    }

    const draft: SalesDraft = {
      state: {
        customerMode,
        selectedCustomerId,
        paymentWorkflow,
        query,
        customerQuery,
        shippingMode,
        selectedShippingAddressId,
        category,
        priceRange,
        quantities,
        customerOpen,
        shippingOpen,
        couponCode
      },
      fields
    };

    localStorage.setItem(salesDraftKey(), JSON.stringify(draft));
  }

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

  function clearSelectedCustomer() {
    setSelectedCustomerId("");
    setCustomerQuery("");
    setCustomerPickerOpen(false);
    setShippingMode("new");
    setSelectedShippingAddressId("");
  }

  return (
    <div className="min-w-0 space-y-6 pb-48 xl:pb-0">
      {createdOrderId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="overflow-hidden rounded-[1.75rem] border border-red-100 bg-white shadow-[0_18px_55px_rgba(185,28,28,0.08)]">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-red-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Needs attention</p>
                <h2 className="mt-1 text-lg font-semibold text-clinic-ink">Order needs one more detail</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-red-700">
                  {errorCopy[error] ?? "Something went wrong while creating the order."}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Your selected customer, products, quantities, and payment action were restored so you can keep going.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShippingOpen(true)}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-white px-4 text-sm font-bold text-red-700 shadow-line transition hover:bg-red-50"
            >
              Review details
            </button>
          </div>
        </div>
      )}
      {!canCreateOrders && setupMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {setupMessage}
        </div>
      )}

      <form
        ref={formRef}
        action={createOrderAction}
        onSubmit={saveSalesDraft}
        className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]"
      >
        <input type="hidden" name="customerMode" value={customerMode} />
        <input type="hidden" name="pipelineStage" value="AWAITING_PAYMENT" />
        <input type="hidden" name="paymentWorkflow" value={paymentWorkflow} />
        {products.map((product) => (
          <input key={product.id} type="hidden" name={`quantity:${product.id}`} value={quantities[product.id] ?? 0} />
        ))}

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="order-1 min-w-0 overflow-visible rounded-2xl">
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
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
                  <input type="hidden" name="customerId" value={selectedCustomerId} />
                  <div className="relative z-20">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Find customer</label>
                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={customerQuery}
                        onChange={(event) => {
                          setCustomerQuery(event.target.value);
                          setCustomerPickerOpen(true);
                        }}
                        onFocus={() => setCustomerPickerOpen(true)}
                        placeholder="Search by name, email, or phone..."
                        className="h-14 rounded-2xl pl-12 pr-24 text-base font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomerPickerOpen((value) => !value)}
                        className="absolute right-2 top-1/2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded-xl bg-clinic-mist px-4 text-sm font-bold text-clinic-navy transition hover:bg-white"
                      >
                        Browse
                      </button>

                      {customerPickerOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-3xl border border-border bg-white shadow-[0_24px_70px_rgba(15,35,58,0.16)]">
                          <div className="max-h-[360px] overflow-y-auto p-2">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map((customer) => {
                                const isSelected = customer.id === selectedCustomerId;

                                return (
                                  <button
                                    key={customer.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCustomerId(customer.id);
                                      setCustomerQuery(customerDisplayName(customer));
                                      setCustomerPickerOpen(false);
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                                      isSelected ? "bg-clinic-mist ring-1 ring-clinic-navy/15" : "hover:bg-clinic-mist"
                                    }`}
                                  >
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-white text-sm font-black text-clinic-navy shadow-line">
                                      {customerInitials(customer)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-black text-clinic-ink">{customerDisplayName(customer)}</span>
                                      <span className="mt-1 grid gap-1 text-xs font-semibold text-slate-500 sm:grid-cols-2">
                                        <span className="truncate">{customer.email}</span>
                                        <span className="truncate">{formatPhoneForDisplay(customer.phone) || "No phone on file"}</span>
                                      </span>
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="rounded-2xl bg-clinic-mist p-5 text-sm font-semibold text-slate-600">
                                No customer matches that name, email, or phone. Switch to New to create a record.
                              </div>
                            )}
                          </div>
                          {matchingCustomers.length > filteredCustomers.length ? (
                            <div className="border-t border-border bg-clinic-mist px-4 py-3 text-xs font-semibold text-slate-500">
                              Showing the first {filteredCustomers.length} matches. Keep typing to narrow the list.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Search the assigned customer list and confirm the email or phone before collecting payment.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border bg-gradient-to-b from-white to-clinic-mist p-4 shadow-line">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Selected customer</p>
                      {selectedCustomer ? (
                        <button
                          type="button"
                          onClick={clearSelectedCustomer}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-xs font-bold text-slate-500 transition hover:border-red-100 hover:bg-red-50 hover:text-red-700"
                        >
                          <X className="h-3.5 w-3.5" />
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {selectedCustomer ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-white text-base font-black text-clinic-navy shadow-line">
                            {customerInitials(selectedCustomer)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-black text-clinic-ink">{customerDisplayName(selectedCustomer)}</p>
                            <p className="mt-1 break-all text-sm font-semibold leading-5 text-slate-500">{selectedCustomer.email}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm font-semibold text-slate-600">
                          <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-border">
                            <span>Phone</span>
                            <span className="text-right text-clinic-ink">{formatPhoneForDisplay(selectedCustomer.phone) || "Not provided"}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500 ring-1 ring-border">
                        Select an existing customer to continue.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">First name</label>
                    <Input name="firstName" placeholder="First name" className="mt-2" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last name</label>
                    <Input name="lastName" placeholder="Last name" className="mt-2" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Email</label>
                    <Input name="email" type="email" placeholder="customer@email.com" className="mt-2" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Phone</label>
                    <PhoneInput name="phone" className="mt-2" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Date of birth</label>
                    <Input name="dateOfBirth" type="date" className="mt-2" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Birth sex</label>
                    <select
                      name="birthSex"
                      className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 text-sm font-semibold text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      defaultValue=""
                      required
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

          <Card className="order-2 min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Shipping address</p>
                  <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">Delivery details</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Confirm the customer&apos;s shipping address before payment. Saved addresses can be reused to move faster on future orders.
                  </p>
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
            <div className={`${shippingOpen ? "block" : "hidden"} space-y-5 p-5`}>
              <input type="hidden" name="shippingAddressMode" value={shippingMode} />
              <input type="hidden" name="shippingAddressId" value={selectedShippingAddressId} />

              {customerMode === "existing" && selectedCustomer?.addresses.length ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Confirm saved address</p>
                      <p className="mt-1 text-sm text-slate-500">Choose the address the customer wants to use for this order.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShippingMode("new");
                        setSelectedShippingAddressId("");
                      }}
                      className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold transition ${
                        shippingMode === "new"
                          ? "border-clinic-navy bg-clinic-navy text-white"
                          : "border-border bg-white text-clinic-navy hover:bg-clinic-mist"
                      }`}
                    >
                      Add new address
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {selectedCustomer.addresses.map((address) => {
                      const selected = shippingMode === "saved" && selectedShippingAddressId === address.id;

                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => {
                            setShippingMode("saved");
                            setSelectedShippingAddressId(address.id);
                          }}
                          className={`rounded-3xl border p-4 text-left transition ${
                            selected
                              ? "border-clinic-navy bg-white shadow-[0_18px_45px_rgba(10,65,111,0.14)]"
                              : "border-border bg-clinic-mist hover:bg-white"
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <span className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${selected ? "bg-clinic-navy text-white" : "bg-white text-clinic-navy"}`}>
                              <Home className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-sm font-black text-clinic-ink">
                                {addressLabel(address)}
                                {address.isDefault ? (
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                                    Default
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block text-sm leading-6 text-slate-600">{addressSummary(address)}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedShippingAddress ? (
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                      Confirmed for this order: {addressSummary(selectedShippingAddress)}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={`${shippingMode === "new" ? "grid" : "hidden"} gap-4 md:grid-cols-2`}>
                {customerMode === "existing" && selectedCustomer?.addresses.length ? (
                  <div className="md:col-span-2 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-sm font-black text-clinic-navy">New shipping address</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      This address will be saved to the customer record after the order is created.
                    </p>
                  </div>
                ) : null}
                <div className="flex items-end md:col-span-2">
                  <label className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-clinic-mist px-4 text-sm font-bold text-clinic-navy">
                    <input name="shippingAddressDefault" type="checkbox" value="true" className="h-4 w-4 rounded border-slate-300" />
                    Make this the default address
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address line 1</label>
                  <Input name="shippingAddressLine1" placeholder="Street address" className="mt-2" required={shippingMode === "new"} disabled={shippingMode !== "new"} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Address line 2</label>
                  <Input name="shippingAddressLine2" placeholder="Apt, suite, unit, optional" className="mt-2" disabled={shippingMode !== "new"} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">City</label>
                  <Input name="shippingCity" placeholder="City" className="mt-2" required={shippingMode === "new"} disabled={shippingMode !== "new"} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">State</label>
                  <select
                    name="shippingState"
                    defaultValue=""
                    className="mt-2 flex h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required={shippingMode === "new"}
                    disabled={shippingMode !== "new"}
                  >
                    <option value="" disabled>
                      Select state
                    </option>
                    {US_STATE_OPTIONS.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">ZIP code</label>
                  <Input name="shippingPostalCode" placeholder="ZIP code" className="mt-2" required={shippingMode === "new"} disabled={shippingMode !== "new"} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Country</label>
                  <Input name="shippingCountry" defaultValue="US" placeholder="Country" className="mt-2" required={shippingMode === "new"} disabled={shippingMode !== "new"} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="order-3 min-w-0 overflow-hidden rounded-2xl">
            <div className="border-b border-border p-5">
              <div className="space-y-5">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Products</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight text-clinic-ink sm:text-3xl">Build the order</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Find the right products, add quantities, and review the order total before collecting payment or sending an invoice.
                  </p>
                </div>
                <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(140px,180px)_minmax(140px,170px)]">
                  <div className="relative sm:col-span-2 lg:col-span-1">
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

        <div className="min-w-0 space-y-5 xl:sticky xl:top-24 xl:self-start">
          <Card className="min-w-0 overflow-hidden rounded-[2rem] border-white/80 bg-white/95 shadow-[0_18px_46px_rgba(7,55,99,0.08)] backdrop-blur-xl">
            <div className="border-b border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Secure checkout</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-clinic-ink">Order summary</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {selectedItemCount} item{selectedItemCount === 1 ? "" : "s"} selected
                  </p>
                </div>
                <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-clinic-mist px-3 py-1 text-xs font-bold text-clinic-navy">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Pending
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl bg-clinic-mist px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order total</p>
                    <p className="text-xs font-semibold text-slate-500">Live</p>
                  </div>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-clinic-navy">{formatCurrency(orderTotalCents)}</p>
                  {discountCents > 0 ? (
                    <p className="mt-1 text-xs font-bold text-emerald-700">Discount applied: -{formatCurrency(discountCents)}</p>
                  ) : null}
                </div>
                <div className="rounded-3xl bg-emerald-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{commissionLabel}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800">{formatCurrency(adjustedCommissionCents)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
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

              <div className="rounded-2xl border border-border bg-clinic-mist p-3">
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Discount code</label>
                <Input
                  name="couponCode"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="Enter coupon"
                  className="mt-2 bg-white uppercase"
                />
                {couponInvalid ? (
                  <p className="mt-2 text-xs font-semibold text-red-700">This code is not active for the selected items.</p>
                ) : appliedDiscount ? (
                  <div className="mt-2 grid gap-1 text-xs font-semibold text-emerald-800">
                    <span>{appliedDiscount.discount.name}: -{formatCurrency(appliedDiscount.discountCents)}</span>
                    <span>Owner protected profit: {formatCurrency(appliedDiscount.ownerProtectedProfitCents)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-slate-500">Optional. Discounts are validated when the order is created.</p>
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-clinic-ink">{formatCurrency(subtotalCents)}</span>
                </div>
                {discountCents > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-semibold text-emerald-700">-{formatCurrency(discountCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-clinic-ink">{formatCurrency(orderTotalCents)}</span>
                </div>
                {appliedDiscount ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commissionable margin</span>
                    <span className="font-semibold text-clinic-ink">{formatCurrency(appliedDiscount.commissionableMarginCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment status</span>
                  <span className="font-semibold text-clinic-ink">Pending</span>
                </div>
              </div>

              <div>
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

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Order notes</label>
                <textarea
                  name="notes"
                  placeholder="Add call context, next step, or payment notes..."
                  className="mt-2 min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <SubmitButton className="w-full" size="lg" pendingText="Creating order..." disabled={!canCreateOrders || selectedLines.length === 0}>
                <CheckCircle2 className="h-4 w-4" />
                {paymentWorkflow === "collect_payment" ? "Collect payment" : "Send invoice"}
              </SubmitButton>
            </div>
          </Card>

          {ownershipCopy ? (
            <Card className="min-w-0 rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-clinic-red" />
                <h2 className="text-lg font-semibold text-clinic-ink">Ownership rule</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {ownershipCopy}
              </p>
            </Card>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/92 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-18px_50px_rgba(7,55,99,0.12)] backdrop-blur-xl lg:left-72 xl:hidden">
            <div className="mx-auto grid max-w-5xl grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_minmax(180px,220px)]">
              <div className="min-w-0 rounded-2xl bg-clinic-mist px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Total</p>
                <p className="truncate text-lg font-semibold text-clinic-navy">{formatCurrency(orderTotalCents)}</p>
              </div>
              <div className="min-w-0 rounded-2xl bg-emerald-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Commission</p>
                <p className="truncate text-lg font-semibold text-emerald-800">{formatCurrency(adjustedCommissionCents)}</p>
              </div>
              <div className="hidden rounded-2xl border border-border bg-white px-3 py-2 text-center sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Items</p>
                <p className="text-lg font-semibold text-clinic-ink">{selectedItemCount}</p>
              </div>
              <SubmitButton className="col-span-2 h-12 rounded-2xl sm:col-span-1" size="lg" pendingText="Creating order..." disabled={!canCreateOrders || selectedLines.length === 0}>
                <CheckCircle2 className="h-4 w-4" />
                {paymentWorkflow === "collect_payment" ? "Collect payment" : "Send invoice"}
              </SubmitButton>
            </div>
          </div>
        </div>
      </form>

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
