import { NextResponse } from "next/server";

import { loadNuvemshopCartOffers } from "@/lib/nuvemshop/cart-offers";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "nuvemshop-cart-offers",
      methods: ["GET", "POST"],
      message:
        "Envie o carrinho atual em POST para receber ofertas no formato 'Por mais R$ X, leve Y'.",
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loadNuvemshopCartOffers(body);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel processar o carrinho para gerar ofertas.",
        cart: {
          subtotal: 0,
          itemCount: 0,
          categoryIds: [],
        },
        offers: [],
      },
      { status: 400 },
    );
  }
}
