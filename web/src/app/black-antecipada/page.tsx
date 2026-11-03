import type {
  CompanyCartDiscountGroup,
  CompanyCartDiscountRule,
  CompanyDiscountProductOption,
} from "@/lib/empresa/repository";
import { loadCompanyDiscountModuleData } from "@/lib/empresa/repository";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  BlackLandingClient,
  type BlackLandingCatalogCategory,
  type BlackLandingOfferSelection,
  type BlackLandingSelectionGroup,
} from "./black-landing-client";
import styles from "./black-landing.module.css";

export const metadata: Metadata = {
  title: "Black Antecipada | Repeticao Maxima",
  description:
    "Escolha seu combo VIP da Black Antecipada e fale com o time da Repeticao Maxima no WhatsApp.",
};

const DEFAULT_WHATSAPP_PHONE = "5511939200878";
const OFFER_QUANTITIES = [2, 4, 5] as const;

const LANDING_CATEGORY_DEFS = [
  {
    key: "minimalistas",
    label: "Minimalistas",
    titleTokens: ["combo", "black", "mini"],
    fallbackMatcher: ["minimalista", "minimalistas"],
  },
  {
    key: "mescladas",
    label: "Mescladas",
    titleTokens: ["combo", "black", "mesclado"],
    fallbackMatcher: ["mesclada", "mescladas", "minimalista", "full estampa"],
  },
  {
    key: "estampadas",
    label: "Estampadas",
    titleTokens: ["combo", "black", "estampado"],
    fallbackMatcher: ["estampada", "estampadas", "full estampa", "full"],
  },
] as const;

export default async function BlackAntecipadaPage() {
  const whatsappPhone =
    process.env.NEXT_PUBLIC_BLACK_COMBOS_WHATSAPP_PHONE?.trim() || DEFAULT_WHATSAPP_PHONE;
  const moduleData = await loadCompanyDiscountModuleData();
  const blackRules = moduleData.rules.filter((rule) =>
    normalizeText(rule.title).includes("combo black"),
  );
  const catalogCategories = buildLandingCatalogCategories(blackRules, moduleData.products);

  return (
    <Suspense fallback={<div className={styles.page} />}>
      <BlackLandingClient
        whatsappPhone={whatsappPhone}
        catalogCategories={catalogCategories}
      />
    </Suspense>
  );
}

function buildLandingCatalogCategories(
  rules: CompanyCartDiscountRule[],
  products: CompanyDiscountProductOption[],
): BlackLandingCatalogCategory[] {
  const productLookup = buildProductLookup(products);

  return LANDING_CATEGORY_DEFS.map((definition) => {
    const offerSelections = Object.fromEntries(
      OFFER_QUANTITIES.map((quantity) => {
        const rule = selectBlackRule(definition.key, quantity, rules);

        if (!rule) {
          return null;
        }

        return [
          buildOfferId(definition.key, quantity),
          buildOfferSelection(definition.key, definition.label, quantity, rule, productLookup),
        ] as const;
      }).filter(Boolean) as Array<readonly [string, BlackLandingOfferSelection]>,
    );

    const fallbackProducts = collectProductsByCategoryName(definition.fallbackMatcher, products);
    const ruleProducts = dedupeProducts(
      Object.values(offerSelections).flatMap((selection) =>
        selection.groups.flatMap((group) => group.products),
      ),
    );

    return {
      key: definition.key,
      label: definition.label,
      configured: Object.keys(offerSelections).length > 0,
      products: ruleProducts.length > 0 ? ruleProducts : fallbackProducts,
      offerSelections,
    };
  });
}

type LandingProductLookup = {
  byId: Map<string, CompanyDiscountProductOption>;
  byName: Map<string, CompanyDiscountProductOption>;
};

function selectBlackRule(
  landingKey: BlackLandingCatalogCategory["key"],
  quantity: (typeof OFFER_QUANTITIES)[number],
  rules: CompanyCartDiscountRule[],
) {
  const definition = LANDING_CATEGORY_DEFS.find((item) => item.key === landingKey);

  if (!definition) {
    return null;
  }

  const matches = rules
    .filter((rule) => {
      const title = normalizeText(rule.title);
      return (
        definition.titleTokens.every((token) => title.includes(normalizeText(token))) &&
        extractRuleQuantity(rule.title) === quantity
      );
    })
    .sort((left, right) => (right.updatedAt || "").localeCompare(left.updatedAt || ""));

  return matches[0] ?? null;
}

function buildOfferSelection(
  categoryKey: BlackLandingCatalogCategory["key"],
  categoryLabel: string,
  quantity: (typeof OFFER_QUANTITIES)[number],
  rule: CompanyCartDiscountRule,
  productLookup: LandingProductLookup,
): BlackLandingOfferSelection {
  const groups =
    rule.ruleMode === "misto" && rule.comboGroups.length > 0
      ? rule.comboGroups
          .map((group, index) =>
            buildSelectionGroup(
              `${categoryKey}-${quantity}-group-${index + 1}`,
              group.categoryName || `Grupo ${index + 1}`,
              Math.max(group.minimumQuantity, 1),
              group,
              productLookup,
            ),
          )
          .filter((group) => group.products.length > 0)
      : [
          buildSelectionGroup(
            `${categoryKey}-${quantity}-group-main`,
            categoryLabel,
            quantity,
            {
              categoryName: rule.categoryName || categoryLabel,
              minimumQuantity: quantity,
              productIds: rule.productIds,
              productNames: rule.productNames,
            },
            productLookup,
          ),
        ];

  return {
    offerId: buildOfferId(categoryKey, quantity),
    totalQuantity: quantity,
    groups,
  };
}

function buildSelectionGroup(
  id: string,
  label: string,
  requiredQuantity: number,
  source: Pick<
    CompanyCartDiscountGroup,
    "categoryName" | "minimumQuantity" | "productIds" | "productNames"
  >,
  productLookup: LandingProductLookup,
): BlackLandingSelectionGroup {
  return {
    id,
    label,
    requiredQuantity,
    products: resolveReferencedProducts(source.productIds, source.productNames, productLookup),
  };
}

function buildOfferId(
  key: BlackLandingCatalogCategory["key"],
  quantity: (typeof OFFER_QUANTITIES)[number],
) {
  return `${key}-${quantity}`;
}

function extractRuleQuantity(title: string) {
  const match = normalizeText(title).match(/(?:^|\s)(2|4|5)(?:$|\s)/);
  return match ? Number(match[1]) : null;
}

function buildProductLookup(products: CompanyDiscountProductOption[]): LandingProductLookup {
  const byId = new Map<string, CompanyDiscountProductOption>();
  const byName = new Map<string, CompanyDiscountProductOption>();

  for (const product of products) {
    byId.set(product.productId, product);
    byName.set(normalizeText(product.productName), product);
  }

  return {
    byId,
    byName,
  };
}

function resolveReferencedProducts(
  productIds: string[],
  productNames: string[],
  productLookup: LandingProductLookup,
): BlackLandingCatalogCategory["products"] {
  const seen = new Set<string>();
  const results: BlackLandingCatalogCategory["products"] = [];
  const maxLength = Math.max(productIds.length, productNames.length);

  for (let index = 0; index < maxLength; index += 1) {
    const productId = productIds[index] ?? "";
    const productName = productNames[index] ?? "";
    const resolvedById = productId ? productLookup.byId.get(productId) : null;
    const resolvedByName = productName
      ? productLookup.byName.get(normalizeText(productName))
      : null;
    const product = resolvedById ?? resolvedByName;

    if (!product || seen.has(product.productId)) {
      continue;
    }

    seen.add(product.productId);
    results.push({
      productId: product.productId,
      productName: product.productName,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls,
    });
  }

  return results;
}

function collectProductsByCategoryName(
  matcher: readonly string[],
  products: CompanyDiscountProductOption[],
): BlackLandingCatalogCategory["products"] {
  return products
    .filter((product) =>
      product.categoryNames.some((categoryName) =>
        matcher.some((token) => normalizeText(categoryName).includes(normalizeText(token))),
      ),
    )
    .map((product) => ({
      productId: product.productId,
      productName: product.productName,
      imageUrl: product.imageUrl,
      imageUrls: product.imageUrls,
    }));
}

function dedupeProducts(products: BlackLandingCatalogCategory["products"]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.productId)) {
      return false;
    }

    seen.add(product.productId);
    return true;
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
