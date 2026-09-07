import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

/**
 * Receipt OCR. Lives in the web app because it is the only server-side surface
 * in this workspace, and because ANTHROPIC_API_KEY must never reach a phone —
 * anything shipped to the host app is readable by whoever installs it.
 *
 * Vision models are slow enough to exceed the default serverless limit.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

/** ~5 MB of base64 is roughly a 3.7 MB image — comfortably inside API limits. */
const MAX_BASE64_LENGTH = 5_000_000;

const SYSTEM = `You read restaurant receipts from Bangladesh and return their line items.

Rules:
- All money is integer Bangladeshi taka. Never return decimals, never return a currency symbol.
- unitPrice is the price of ONE unit, not the line total. If a receipt shows a line
  total for multiple units, divide it by the quantity.
- Capture every ordered item. Do not invent items you cannot read.
- vat, serviceCharge and discount are bill-level charges. Use 0 when absent.
- receiptTotal is the final amount payable printed on the receipt.
- Bengali and English item names both appear; keep the name as printed, transliterating
  Bengali script to Latin characters so it is readable in a Latin-script UI.
- If the image is not a receipt, or is too unclear to read, set readable to false and
  explain briefly in note. Do not guess.`;

const SCHEMA = {
  type: "object",
  properties: {
    readable: { type: "boolean", description: "False when this is not a legible receipt." },
    note: { type: "string", description: "Short explanation when readable is false, else empty." },
    restaurantName: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          unitPrice: { type: "integer", minimum: 0, description: "Price of one unit, in taka." },
        },
        required: ["name", "quantity", "unitPrice"],
        additionalProperties: false,
      },
    },
    vat: { type: "integer", minimum: 0 },
    serviceCharge: { type: "integer", minimum: 0 },
    discount: { type: "integer", minimum: 0 },
    receiptTotal: { type: "integer", minimum: 0 },
  },
  required: ["readable", "note", "restaurantName", "items", "vat", "serviceCharge", "discount", "receiptTotal"],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Receipt scanning isn’t configured. Set ANTHROPIC_API_KEY on the server." },
      { status: 501 },
    );
  }

  let body: { image?: unknown; mediaType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  const mediaType = MEDIA_TYPES.includes(body.mediaType as MediaType)
    ? (body.mediaType as MediaType)
    : "image/jpeg";

  if (!image) return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "That photo is too large. Try again, closer in." }, { status: 413 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: SYSTEM,
      // Reading a creased, angled receipt and doing the per-unit arithmetic
      // benefits from thinking; the extraction itself is not a long output.
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "Extract this receipt." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "That image couldn’t be processed." }, { status: 422 });
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "No receipt data came back. Try again." }, { status: 502 });
    }

    const parsed = JSON.parse(text.text) as {
      readable: boolean;
      note: string;
      items: { name: string; quantity: number; unitPrice: number }[];
    };

    if (!parsed.readable || parsed.items.length === 0) {
      return NextResponse.json(
        { error: parsed.note?.trim() || "That doesn’t look like a receipt. Try another photo." },
        { status: 422 },
      );
    }

    return NextResponse.json(parsed);
  } catch (cause) {
    if (cause instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Too many scans right now. Try again in a moment." }, { status: 429 });
    }
    if (cause instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Receipt scanning is misconfigured on the server." }, { status: 500 });
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `Couldn’t read that receipt: ${message}` }, { status: 502 });
  }
}
