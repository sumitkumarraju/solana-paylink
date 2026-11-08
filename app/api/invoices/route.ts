import { createInvoice, type NewInvoiceInput, validateInvoiceInput, ValidationError } from "@/lib/invoices";
import { checkRecipientCanReceiveUsdc } from "@/lib/pay";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  let fields;
  try {
    fields = validateInvoiceInput(body as NewInvoiceInput);
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: "Invalid invoice.", fields: error.fields }, { status: 422 });
    }
    throw error;
  }

  let canReceive: boolean;
  try {
    canReceive = await checkRecipientCanReceiveUsdc(fields.recipient);
  } catch (error) {
    console.error("Recipient token account check failed", error);
    return Response.json(
      { error: "Could not reach Solana to check your wallet. Try again in a moment." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
  if (!canReceive) {
    return Response.json(
      {
        error: "Invalid invoice.",
        fields: {
          recipient:
            "This wallet has no USDC account yet, so it cannot receive USDC. Receive any amount of USDC to it once (or add USDC in your wallet app), then try again.",
        },
      },
      { status: 422 },
    );
  }

  const invoice = await createInvoice(fields);
  return Response.json({ invoice }, { status: 201 });
}
