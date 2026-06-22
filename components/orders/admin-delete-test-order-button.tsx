"use client";

import { Trash2 } from "lucide-react";
import { deleteAdminTestOrder } from "@/app/orders/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export function AdminDeleteTestOrderButton({
  orderId,
  compact = false
}: {
  orderId: string;
  compact?: boolean;
}) {
  return (
    <form
      action={deleteAdminTestOrder}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Delete this test order? This removes its items, pending payment records, commission records, and pipeline references. This cannot be undone."
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        pendingText="Deleting..."
        className="border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <Trash2 className="size-4" />
        {compact ? "Delete" : "Delete test order"}
      </SubmitButton>
    </form>
  );
}
