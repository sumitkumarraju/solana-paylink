import { getInvoice } from "@/lib/invoices";
import { refreshPaymentStatus } from "@/lib/pay";

// Polled by the pay page. Checks the chain for a payment (rate limited per
// invoice) and returns only what the payer needs to see.
export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]/status">) {
  const { id } = await ctx.params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  }

  try {
    const current = await refreshPaymentStatus(invoice);
    return Response.json(
      { status: current.status, signature: current.signature, paidAt: current.paidAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`Payment check failed for invoice ${id}`, error);
    return Response.json(
      { status: invoice.status, signature: invoice.signature, paidAt: invoice.paidAt, error: "Could not reach Solana. Retrying." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }
}
