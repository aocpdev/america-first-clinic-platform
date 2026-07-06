"use client";

import { useMemo, useState } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Boxes, Check, ImageIcon, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  updateProduct,
  uploadProductImage
} from "@/app/admin/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  centsToDollars,
  formatCurrency,
  formatPercentBps,
  linesToTextarea
} from "@/lib/products/catalog";

type ProductImageView = {
  id: string;
  url: string;
  alt: string | null;
};

type ProductView = {
  id: string;
  title: string;
  description: string;
  sku: string;
  categoryName: string;
  priceCents: number;
  internalCostCents: number;
  marginBps: number;
  active: boolean;
  supportsSubscription: boolean;
  supportsRecurring: boolean;
  inventory: {
    quantityOnHand: number;
    reorderPoint: number;
  } | null;
  image: ProductImageView | null;
  orderItemCount: number;
  revenueCents: number;
  unitsSold: number;
  salesGuide: {
    benefits: string[];
    talkingPoints: string[];
    commonObjections: string[];
    callNotes: string;
  };
};

type ProductCatalogClientProps = {
  products: ProductView[];
  categories: string[];
  activeProducts: number;
  totalRevenueCents: number;
  inactiveProducts: number;
};

function ProductModal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-clinic-navy/30 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="mx-auto max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-2xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(7,55,99,0.18)] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Product settings</p>
            <h3 className="mt-1 text-xl font-semibold text-clinic-ink">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-slate-500 transition hover:bg-clinic-mist hover:text-clinic-ink"
            aria-label="Close product modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-82px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{children}</label>;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-24 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-clinic-ink shadow-line transition placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

function ProductFormFields({ product, categories }: { product?: ProductView; categories: string[] }) {
  return (
    <>
      {product && <input type="hidden" name="productId" value={product.id} />}
      <input type="hidden" name="healthcareCategory" value="wellness" />
      <input type="hidden" name="importSource" value={product ? "admin-edit" : "manual"} />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <FieldLabel>Product title</FieldLabel>
          <Input name="title" defaultValue={product?.title} placeholder="Product title" required className="mt-2" />
        </div>
        <div className="lg:col-span-2">
          <FieldLabel>SKU</FieldLabel>
          <Input name="sku" defaultValue={product?.sku} placeholder="SKU" required className="mt-2" />
        </div>
        <div className="lg:col-span-3">
          <FieldLabel>Category</FieldLabel>
          <Input name="categoryName" defaultValue={product?.categoryName} placeholder="Category" list="product-categories" required className="mt-2" />
        </div>
        <div className="lg:col-span-1">
          <FieldLabel>Price</FieldLabel>
          <Input name="price" defaultValue={product ? centsToDollars(product.priceCents) : undefined} placeholder="0.00" required className="mt-2" />
        </div>
        <div className="lg:col-span-1">
          <FieldLabel>Cost</FieldLabel>
          <Input name="internalCost" defaultValue={product ? centsToDollars(product.internalCostCents) : undefined} placeholder="0.00" required className="mt-2" />
        </div>
        <div className="lg:col-span-12">
          <FieldLabel>Description</FieldLabel>
          <Textarea name="description" defaultValue={product?.description} placeholder="Short internal and customer-facing product description" required className="mt-2" />
        </div>
      </div>

      <input type="hidden" name="quantityOnHand" value={product?.inventory?.quantityOnHand ?? 0} />
      <input type="hidden" name="reorderPoint" value={product?.inventory?.reorderPoint ?? 10} />

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-3 rounded-lg border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
          <input name="active" type="checkbox" defaultChecked={product?.active ?? true} className="h-4 w-4" />
          Active in catalog
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
          <input name="supportsSubscription" type="checkbox" defaultChecked={product?.supportsSubscription ?? false} className="h-4 w-4" />
          Subscription
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
          <input name="supportsRecurring" type="checkbox" defaultChecked={product?.supportsRecurring ?? false} className="h-4 w-4" />
          Recurring billing
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-clinic-mist px-4 py-3 text-sm font-semibold text-clinic-ink">
          <input name="requiresConsult" type="checkbox" className="h-4 w-4" />
          Consult workflow
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-semibold text-clinic-ink">Sales enablement guide</h4>
            <p className="mt-1 text-sm text-slate-500">This is what agents use during calls. Keep it clear, compliant, and easy to scan.</p>
          </div>
          <Badge className="border-blue-100 bg-blue-50 text-clinic-navy">Agent-facing</Badge>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Key benefits</FieldLabel>
            <Textarea name="benefits" defaultValue={product ? linesToTextarea(product.salesGuide.benefits) : undefined} placeholder="One benefit per line" className="mt-2" />
          </div>
          <div>
            <FieldLabel>Talking points</FieldLabel>
            <Textarea name="talkingPoints" defaultValue={product ? linesToTextarea(product.salesGuide.talkingPoints) : undefined} placeholder="One talking point per line" className="mt-2" />
          </div>
          <div>
            <FieldLabel>Objections</FieldLabel>
            <Textarea name="commonObjections" defaultValue={product ? linesToTextarea(product.salesGuide.commonObjections) : undefined} placeholder="One objection response per line" className="mt-2" />
          </div>
          <div>
            <FieldLabel>Call notes</FieldLabel>
            <Textarea name="callNotes" defaultValue={product?.salesGuide.callNotes} placeholder="Compliance notes, disclaimers, and sales call context" className="mt-2" />
          </div>
        </div>
      </div>

      <datalist id="product-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
    </>
  );
}

export function ProductCatalogClient({
  products,
  categories,
  activeProducts,
  totalRevenueCents,
  inactiveProducts
}: ProductCatalogClientProps) {
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [editingProductId, products]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Active products</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{activeProducts}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Catalog revenue</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{formatCurrency(totalRevenueCents)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Inactive products</p>
          <p className="mt-3 text-3xl font-semibold text-clinic-navy">{inactiveProducts}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-line lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-clinic-red" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Go Virtual Health catalog</p>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-clinic-ink">Products</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Admins control product details, margins, images, sales guidance, and catalog availability.
          </p>
        </div>
        <Button type="button" onClick={() => setAddingProduct(true)} className="w-full lg:w-auto">
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {products.map((product) => {
            return (
              <Card key={product.id} className="group overflow-hidden rounded-2xl">
                <div className="relative aspect-[4/3] bg-clinic-mist">
                  {product.image ? (
                    <img src={product.image.url} alt={product.image.alt ?? product.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-xs font-semibold uppercase tracking-[0.14em]">No image</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Badge className={product.active ? "border-emerald-200 bg-white/90 text-emerald-700" : "border-slate-200 bg-white/90 text-slate-600"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4">
                  <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-clinic-ink" title={product.title}>{product.title}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-2xl font-semibold text-clinic-navy">{formatCurrency(product.priceCents)}</p>
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setEditingProductId(product.id)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <ImageIcon className="h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-xl font-semibold text-clinic-ink">No products yet</h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">Create the first catalog item and add its sales guide so agents can start building orders.</p>
          <Button type="button" onClick={() => setAddingProduct(true)} className="mt-5">
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </Card>
      )}

      <ProductModal open={addingProduct} title="Add product" onClose={() => setAddingProduct(false)}>
        <form action={createProduct}>
          <ProductFormFields categories={categories} />
          <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => setAddingProduct(false)}>Cancel</Button>
            <SubmitButton pendingText="Adding...">
              <Plus className="h-4 w-4" />
              Add product
            </SubmitButton>
          </div>
        </form>
      </ProductModal>

      <ProductModal open={!!editingProduct} title={editingProduct?.title ?? "Edit product"} onClose={() => setEditingProductId(null)}>
        {editingProduct && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-clinic-mist">
                <div className="aspect-square">
                  {editingProduct.image ? (
                    <img src={editingProduct.image.url} alt={editingProduct.image.alt ?? editingProduct.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-400">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-xs font-semibold uppercase tracking-[0.14em]">No image</span>
                    </div>
                  )}
                </div>
              </div>
              <form action={uploadProductImage} className="rounded-xl border border-border bg-white p-4">
                <input type="hidden" name="productId" value={editingProduct.id} />
                <FieldLabel>Product image</FieldLabel>
                <input
                  name="image"
                  type="file"
                  accept="image/*"
                  className="mt-3 w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-clinic-navy file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                  required
                />
                <SubmitButton size="sm" className="mt-3 w-full" pendingText="Uploading...">
                  <Upload className="h-4 w-4" />
                  Upload image
                </SubmitButton>
              </form>
              {editingProduct.image && (
                <form action={deleteProductImage}>
                  <input type="hidden" name="imageId" value={editingProduct.image.id} />
                  <SubmitButton size="sm" variant="outline" className="w-full text-clinic-red" pendingText="Removing...">
                    <Trash2 className="h-4 w-4" />
                    Remove image
                  </SubmitButton>
                </form>
              )}
              <div className="rounded-xl border border-border bg-clinic-mist p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sales stats</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-clinic-ink">{formatCurrency(editingProduct.revenueCents)}</p>
                    <p className="text-slate-500">Revenue</p>
                  </div>
                  <div>
                    <p className="font-semibold text-clinic-ink">{editingProduct.unitsSold}</p>
                    <p className="text-slate-500">Units</p>
                  </div>
                  <div>
                    <p className="font-semibold text-clinic-ink">{formatCurrency(editingProduct.internalCostCents)}</p>
                    <p className="text-slate-500">Cost</p>
                  </div>
                  <div>
                    <p className="font-semibold text-clinic-ink">{formatPercentBps(editingProduct.marginBps)}</p>
                    <p className="text-slate-500">Margin</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <form id={`edit-product-${editingProduct.id}`} action={updateProduct}>
                <ProductFormFields product={editingProduct} categories={categories} />
              </form>
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <form action={deleteProduct} onSubmit={(event) => {
                    if (!window.confirm("Delete this product? Products with order history will be archived instead.")) {
                      event.preventDefault();
                    }
                  }}>
                  <input type="hidden" name="productId" value={editingProduct.id} />
                  <SubmitButton variant="outline" pendingText="Deleting..." className="w-full text-clinic-red sm:w-auto">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </SubmitButton>
                </form>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setEditingProductId(null)}>Cancel</Button>
                  <SubmitButton form={`edit-product-${editingProduct.id}`} pendingText="Saving...">
                    <Check className="h-4 w-4" />
                    Save changes
                  </SubmitButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </ProductModal>
    </div>
  );
}
