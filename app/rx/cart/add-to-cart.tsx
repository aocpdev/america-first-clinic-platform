import { ShoppingBag } from "lucide-react";
import { addToCart } from "./actions";
import { CartSubmit } from "./cart-submit";

export function AddToCart({ productId, title, quantity = 1 }: { productId: string; title: string; quantity?: number }) {
  return <form action={addToCart} aria-label={`Add ${title} to cart`} className="rx-add-cart">
    <input type="hidden" name="productId" value={productId} /><input type="hidden" name="quantity" value={quantity} />
    <CartSubmit pendingText="Adding…"><ShoppingBag size={17} aria-hidden="true" />Add to cart</CartSubmit>
  </form>;
}
