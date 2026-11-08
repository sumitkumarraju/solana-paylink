import { getInvoice } from "@/lib/invoices";

export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  }
  return Response.json({ invoice });
}
