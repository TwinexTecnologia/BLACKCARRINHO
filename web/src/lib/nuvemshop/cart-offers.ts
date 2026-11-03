import { getNuvemshopCredentials, NuvemshopClient } from "./client";
import type { NuvemshopLocalizedText, NuvemshopOrder, NuvemshopProduct, NuvemshopVariant } from "./types";

const NUVEMSHOP_PAGE_SIZE = 100;
const NUVEMSHOP_MAX_PAGES = 6;

export type CartOfferRequestItem = {
  productId: string | null;
  variantId: string | null;
  quantity: number;
  unitPrice: number | null;
  matchIds: string[];
};

export type CartOffer = {
  productId: string;
  variantId: string;
  productName: string;
  imageUrl: string | null;
  categoryIds: string[];
  categoryNames: string[];
  price: number;
  compareAtPrice: number | null;
  hasDiscount: boolean;
  recentSales30d: number;
  score: number;
  reason: string;
  headline: string;
  ctaLabel: string;
  addToCart: {
    productId: string;
    variantId: string;
    quantity: number;
  };
};

export type CartOffersResult =
  | {
      ok: true;
      message: string;
      cart: {
        subtotal: number;
        itemCount: number;
        categoryIds: string[];
      };
      offers: CartOffer[];
    }
  | {
      ok: false;
      message: string;
      cart: {
        subtotal: number;
        itemCount: number;
        categoryIds: string[];
      };
      offers: CartOffer[];
    };

type NormalizedCartItem = CartOfferRequestItem;

type CatalogCandidate = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  categoryIds: string[];
  categoryNames: string[];
  matchIds: string[];
  variantId: string;
  price: number;
  compareAtPrice: number | null;
  hasDiscount: boolean;
  stock: number | null;
  recentSales30d: number;
};

export async function loadNuvemshopCartOffers(input: unknown): Promise<CartOffersResult> {
  const normalizedCart = normalizeCartOfferRequest(input);
  const credentials = getNuvemshopCredentials();

  if (!credentials.ok) {
    return {
      ok: false,
      message: `Catalogo da Nuvemshop indisponivel. Configure ${credentials.missing.join(" e ")}.`,
      cart: {
        subtotal: normalizedCart.subtotal,
        itemCount: normalizedCart.itemCount,
        categoryIds: [],
      },
      offers: [],
    };
  }

  try {
    const client = new NuvemshopClient(credentials.credentials);
    const [products, orders] = await Promise.all([
      fetchAllNuvemshopPages((params) => client.listProducts(params)),
      fetchAllNuvemshopPages((params) => client.listOrders(params)),
    ]);
    const recentSalesByProductId = buildRecentSalesMap(orders);
    const candidates = buildCatalogCandidates(products, recentSalesByProductId);
    const cartContext = buildCartContext(normalizedCart.items, candidates, normalizedCart.subtotal);
    const offers = rankCartOffers(candidates, cartContext);

    return {
      ok: true,
      message:
        offers.length > 0
          ? "Ofertas de carrinho geradas com sucesso."
          : "Nenhuma oferta elegivel foi encontrada para o carrinho atual.",
      cart: {
        subtotal: cartContext.subtotal,
        itemCount: cartContext.itemCount,
        categoryIds: Array.from(cartContext.categoryIds),
      },
      offers,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Nao foi possivel gerar as ofertas do carrinho: ${error.message}`
          : "Nao foi possivel gerar as ofertas do carrinho.",
      cart: {
        subtotal: normalizedCart.subtotal,
        itemCount: normalizedCart.itemCount,
        categoryIds: [],
      },
      offers: [],
    };
  }
}

function normalizeCartOfferRequest(input: unknown) {
  const source = isRecord(input) ? input : {};
  const items = extractCartItems(source);
  const explicitSubtotal = firstPositiveNumber([
    source.subtotal,
    source.subtotal_price,
    source.total,
    source.total_price,
    isRecord(source.cart) ? source.cart.subtotal : null,
    isRecord(source.cart) ? source.cart.subtotal_price : null,
    isRecord(source.cart) ? source.cart.total : null,
    isRecord(source.cart) ? source.cart.total_price : null,
  ]);
  const computedSubtotal = items.reduce((sum, item) => {
    if (item.unitPrice === null) {
      return sum;
    }

    return sum + item.unitPrice * item.quantity;
  }, 0);

  return {
    subtotal: explicitSubtotal ?? computedSubtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
  };
}

function extractCartItems(source: Record<string, unknown>) {
  const directCollections = [
    source.line_items,
    source.items,
    source.products,
  ];
  const cartSource = isRecord(source.cart) ? source.cart : {};
  const nestedCollections = [
    cartSource.line_items,
    cartSource.items,
    cartSource.products,
  ];
  const collection = [...directCollections, ...nestedCollections].find(Array.isArray);

  if (!Array.isArray(collection)) {
    return [] as NormalizedCartItem[];
  }

  return collection
    .map((item) => normalizeCartItem(item))
    .filter((item): item is NormalizedCartItem => item.quantity > 0 && item.matchIds.length > 0);
}

function normalizeCartItem(input: unknown): NormalizedCartItem {
  const source = isRecord(input) ? input : {};
  const productId = readFirstString(source, ["productId", "product_id"]);
  const variantId = readFirstString(source, ["variantId", "variant_id", "id"]);
  const quantity = Math.max(getNumberValue(source.quantity, 1), 1);
  const unitPrice = firstPositiveNumber([
    source.price,
    source.unit_price,
    source.promotional_price,
  ]);
  const matchIds = Array.from(
    new Set(
      [
        productId,
        variantId,
        ...readStringArray(source.matchIds),
      ].filter(Boolean) as string[],
    ),
  );

  return {
    productId,
    variantId,
    quantity,
    unitPrice,
    matchIds,
  };
}

function buildCatalogCandidates(
  products: NuvemshopProduct[],
  recentSalesByProductId: Map<string, number>,
) {
  return products
    .map((product) => buildCatalogCandidate(product, recentSalesByProductId))
    .filter((candidate): candidate is CatalogCandidate => Boolean(candidate));
}

function buildCatalogCandidate(
  product: NuvemshopProduct,
  recentSalesByProductId: Map<string, number>,
) {
  const productId = String(product.id ?? "").trim();
  const productName = getLocalizedText(product.name).trim();

  if (!productId || !productName || product.published === false) {
    return null;
  }

  const categories = (product.categories ?? [])
    .map((category) => ({
      id: String(category.id ?? "").trim(),
      name: getLocalizedText(category.name).trim(),
    }))
    .filter((category) => category.id && category.name);
  const selectedVariant = pickOfferVariant(product);

  if (!selectedVariant) {
    return null;
  }

  return {
    productId,
    productName,
    imageUrl:
      product.images && typeof product.images[0]?.src === "string"
        ? product.images[0].src
        : null,
    categoryIds: categories.map((category) => category.id),
    categoryNames: categories.map((category) => category.name),
    matchIds: Array.from(
      new Set(
        [productId, ...(product.variants ?? []).map((variant) => String(variant.id ?? "").trim())].filter(Boolean),
      ),
    ),
    variantId: selectedVariant.variantId,
    price: selectedVariant.price,
    compareAtPrice: selectedVariant.compareAtPrice,
    hasDiscount: selectedVariant.hasDiscount,
    stock: selectedVariant.stock,
    recentSales30d: recentSalesByProductId.get(productId) ?? 0,
  } satisfies CatalogCandidate;
}

function pickOfferVariant(product: NuvemshopProduct) {
  const variants = product.variants ?? [];
  const candidates = variants
    .map((variant) => {
      const priceValue = firstPositiveNumber([variant.promotional_price, variant.price]);

      if (priceValue === null) {
        return null;
      }

      const fullPrice = firstPositiveNumber([variant.compare_at_price, variant.price]);
      const stock = getVariantStock(variant);
      const available = stock === null ? product.has_stock !== false : stock > 0;

      if (!available) {
        return null;
      }

      return {
        variantId: String(variant.id ?? "").trim(),
        price: priceValue,
        compareAtPrice: fullPrice && fullPrice > priceValue ? fullPrice : null,
        hasDiscount: Boolean(fullPrice && fullPrice > priceValue),
        stock,
      };
    })
    .filter((variant): variant is { variantId: string; price: number; compareAtPrice: number | null; hasDiscount: boolean; stock: number | null } => Boolean(variant && variant.variantId))
    .sort((left, right) => {
      if (left.price !== right.price) {
        return left.price - right.price;
      }

      return right.hasDiscount === left.hasDiscount ? 0 : right.hasDiscount ? 1 : -1;
    });

  return candidates[0] ?? null;
}

function getVariantStock(variant: NuvemshopVariant) {
  const values = [
    variant.stock,
    variant.inventory,
    ...(Array.isArray(variant.inventory_levels)
      ? variant.inventory_levels.map((level) => level.stock ?? null)
      : []),
  ]
    .map((value) => getNumberValue(value, Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function buildCartContext(items: NormalizedCartItem[], candidates: CatalogCandidate[], subtotal: number) {
  const productMap = new Map<string, CatalogCandidate>();
  const cartMatchIds = new Set<string>();
  const categoryIds = new Set<string>();

  for (const candidate of candidates) {
    for (const matchId of candidate.matchIds) {
      productMap.set(matchId, candidate);
    }
  }

  for (const item of items) {
    for (const matchId of item.matchIds) {
      cartMatchIds.add(matchId);
      const candidate = productMap.get(matchId);

      if (!candidate) {
        continue;
      }

      candidate.categoryIds.forEach((categoryId) => categoryIds.add(categoryId));
    }
  }

  return {
    subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    cartMatchIds,
    categoryIds,
  };
}

function rankCartOffers(candidates: CatalogCandidate[], cartContext: {
  subtotal: number;
  itemCount: number;
  cartMatchIds: Set<string>;
  categoryIds: Set<string>;
}) {
  const scored = candidates
    .filter((candidate) => !candidate.matchIds.some((matchId) => cartContext.cartMatchIds.has(matchId)))
    .map((candidate) => buildCartOffer(candidate, cartContext))
    .sort((left, right) => right.score - left.score);

  const result: CartOffer[] = [];
  const usedCategories = new Set<string>();

  for (const offer of scored) {
    const primaryCategory = offer.categoryIds[0] ?? "";

    if (
      result.length < 2 ||
      !primaryCategory ||
      !usedCategories.has(primaryCategory)
    ) {
      result.push(offer);

      if (primaryCategory) {
        usedCategories.add(primaryCategory);
      }
    }

    if (result.length === 3) {
      return result;
    }
  }

  return result.length > 0 ? result : scored.slice(0, 3);
}

function buildCartOffer(candidate: CatalogCandidate, cartContext: {
  subtotal: number;
  categoryIds: Set<string>;
}) {
  const sharedCategories = candidate.categoryIds.filter((categoryId) => cartContext.categoryIds.has(categoryId)).length;
  const salesScore = Math.min(candidate.recentSales30d, 40) * 1.1;
  const categoryScore = sharedCategories * 18;
  const priceScore = getPriceFitScore(candidate.price, cartContext.subtotal);
  const discountScore = candidate.hasDiscount ? 10 : 0;
  const stockScore = candidate.stock === null ? 3 : Math.min(candidate.stock, 12) * 0.5;
  const score = categoryScore + salesScore + priceScore + discountScore + stockScore;
  const reason =
    sharedCategories > 0
      ? "Combina com o que ja esta no carrinho"
      : candidate.recentSales30d >= 6
        ? "Esta vendendo bem e costuma ter boa saida"
        : candidate.hasDiscount
          ? "Ja esta com preco promocional e tem baixa friccao"
          : "Boa opcao para aumentar o ticket sem pesar";

  return {
    productId: candidate.productId,
    variantId: candidate.variantId,
    productName: candidate.productName,
    imageUrl: candidate.imageUrl,
    categoryIds: candidate.categoryIds,
    categoryNames: candidate.categoryNames,
    price: candidate.price,
    compareAtPrice: candidate.compareAtPrice,
    hasDiscount: candidate.hasDiscount,
    recentSales30d: candidate.recentSales30d,
    score: Math.round(score * 10) / 10,
    reason,
    headline: `Por mais ${formatMoney(candidate.price)}, leve ${candidate.productName}`,
    ctaLabel: "Adicionar",
    addToCart: {
      productId: candidate.productId,
      variantId: candidate.variantId,
      quantity: 1,
    },
  } satisfies CartOffer;
}

function getPriceFitScore(price: number, subtotal: number) {
  const effectiveSubtotal = subtotal > 0 ? subtotal : 120;
  const idealMin = Math.max(14.9, effectiveSubtotal * 0.08);
  const idealMax = Math.min(149.9, Math.max(39.9, effectiveSubtotal * 0.28));

  if (price >= idealMin && price <= idealMax) {
    return 28;
  }

  if (price >= idealMin * 0.7 && price <= idealMax * 1.2) {
    return 16;
  }

  if (price <= idealMax * 1.6) {
    return 8;
  }

  return 0;
}

async function fetchAllNuvemshopPages<T>(
  loader: (params: { page: number; perPage: number }) => Promise<T[]>,
) {
  const result: T[] = [];

  for (let page = 1; page <= NUVEMSHOP_MAX_PAGES; page += 1) {
    const batch = await loader({ page, perPage: NUVEMSHOP_PAGE_SIZE });
    result.push(...batch);

    if (batch.length < NUVEMSHOP_PAGE_SIZE) {
      break;
    }
  }

  return result;
}

function buildRecentSalesMap(orders: NuvemshopOrder[]) {
  const sales = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  for (const order of orders) {
    if (!order.created_at) {
      continue;
    }

    const createdAt = new Date(order.created_at);

    if (Number.isNaN(createdAt.getTime()) || createdAt < cutoff) {
      continue;
    }

    for (const product of order.products || []) {
      const productId = product.product_id ? String(product.product_id).trim() : "";

      if (!productId) {
        continue;
      }

      const quantity =
        typeof product.quantity === "number" && Number.isFinite(product.quantity)
          ? product.quantity
          : 0;

      sales.set(productId, (sales.get(productId) ?? 0) + quantity);
    }
  }

  return sales;
}

function getLocalizedText(value: NuvemshopLocalizedText) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return value.pt || value["pt-BR"] || value.es || value.en || "";
  }

  return "";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getNumberValue(value: unknown, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const sanitized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstPositiveNumber(values: unknown[]) {
  for (const value of values) {
    const parsed = getNumberValue(value, Number.NaN);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function readFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : ""))
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
