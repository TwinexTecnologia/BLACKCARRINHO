"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import styles from "./black-landing.module.css";

const TRACK_ENDPOINT = "/api/public/vip-group/track";
const LANDING_SLUG = "black-antecipada";
const VISITOR_STORAGE_KEY = "rm-black-antecipada-visitor-id";
const VIEW_STORAGE_KEY = "rm-black-antecipada-last-view";
const VIEW_DEDUP_WINDOW_MS = 1000 * 60 * 60 * 6;
const SELECTION_SECTION_ID = "black-combo-selection";
const PAGE_BACKGROUND_STYLE = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  color: "#fff5ff",
  background:
    "radial-gradient(circle at top left, rgba(142, 56, 255, 0.25), transparent 28%), radial-gradient(circle at bottom right, rgba(255, 119, 29, 0.22), transparent 26%), linear-gradient(180deg, #09020f 0%, #180622 52%, #08010c 100%)",
} as const;

type BlackLandingClientProps = {
  whatsappPhone: string;
  catalogCategories: BlackLandingCatalogCategory[];
};

export type ComboCategoryKey = "minimalistas" | "mescladas" | "estampadas";

export type BlackLandingCatalogProduct = {
  productId: string;
  productName: string;
  imageUrl: string | null;
  imageUrls: string[];
};

export type BlackLandingSelectionGroup = {
  id: string;
  label: string;
  requiredQuantity: number;
  products: BlackLandingCatalogProduct[];
};

export type BlackLandingOfferSelection = {
  offerId: string;
  totalQuantity: number;
  groups: BlackLandingSelectionGroup[];
};

export type BlackLandingCatalogCategory = {
  key: ComboCategoryKey;
  label: string;
  configured: boolean;
  products: BlackLandingCatalogProduct[];
  offerSelections: Record<string, BlackLandingOfferSelection>;
};

type TrackingPayload = {
  eventType: "view" | "click";
  visitorId: string;
  landingSlug: string;
  pageUrl: string;
  referrerUrl: string;
  targetUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

type ComboOffer = {
  id: string;
  title: string;
  shortLabel: string;
  quantity: string;
  details: string;
  originalPrice: string;
  promoPrice: string;
  savings: string;
  pricePerShirt: string;
};

type ComboCategory = {
  key: ComboCategoryKey;
  label: string;
  eyebrow: string;
  description: string;
  highlight: string;
  offers: ComboOffer[];
};

const COMBO_CATEGORIES: ComboCategory[] = [
  {
    key: "minimalistas",
    label: "Minimalistas",
    eyebrow: "Combo minimalista",
    description: "Modelos limpos para montar o combo com maior desconto por peca.",
    highlight: "Economia maxima no VIP",
    offers: [
      {
        id: "minimalistas-2",
        title: "2 camisetas",
        shortLabel: "2",
        quantity: "2 camisetas",
        details: "Selecao minimalista da Black Antecipada.",
        originalPrice: "R$ 199,80",
        promoPrice: "R$ 139,90",
        savings: "R$ 59,90",
        pricePerShirt: "R$ 69,95",
      },
      {
        id: "minimalistas-4",
        title: "4 camisetas",
        shortLabel: "4",
        quantity: "4 camisetas",
        details: "Mais variedade com o melhor custo por camiseta.",
        originalPrice: "R$ 399,60",
        promoPrice: "R$ 259,90",
        savings: "R$ 139,70",
        pricePerShirt: "R$ 64,98",
      },
      {
        id: "minimalistas-5",
        title: "5 camisetas",
        shortLabel: "5",
        quantity: "5 camisetas",
        details: "Combo para fechar o drop com economia forte.",
        originalPrice: "R$ 499,50",
        promoPrice: "R$ 319,90",
        savings: "R$ 179,60",
        pricePerShirt: "R$ 63,98",
      },
    ],
  },
  {
    key: "mescladas",
    label: "Mescladas",
    eyebrow: "Combo mesclado",
    description: "Combina minimalistas com estampadas no mesmo pedido.",
    highlight: "Mix pronto para vender rapido",
    offers: [
      {
        id: "mescladas-2",
        title: "2 camisetas",
        shortLabel: "2",
        quantity: "2 camisetas",
        details: "1 minimalista + 1 estampada.",
        originalPrice: "R$ 199,80",
        promoPrice: "R$ 169,90",
        savings: "R$ 29,90",
        pricePerShirt: "R$ 84,95",
      },
      {
        id: "mescladas-4",
        title: "4 camisetas",
        shortLabel: "4",
        quantity: "4 camisetas",
        details: "2 minimalistas + 2 estampadas.",
        originalPrice: "R$ 399,60",
        promoPrice: "R$ 309,90",
        savings: "R$ 89,70",
        pricePerShirt: "R$ 77,48",
      },
      {
        id: "mescladas-5",
        title: "5 camisetas",
        shortLabel: "5",
        quantity: "5 camisetas",
        details: "3 minimalistas + 2 estampadas.",
        originalPrice: "R$ 499,50",
        promoPrice: "R$ 369,90",
        savings: "R$ 129,60",
        pricePerShirt: "R$ 73,98",
      },
    ],
  },
  {
    key: "estampadas",
    label: "Estampadas",
    eyebrow: "Combo estampado",
    description: "Opcoes com mais presenca visual para destacar a campanha.",
    highlight: "Visual forte para a Black",
    offers: [
      {
        id: "estampadas-2",
        title: "2 camisetas",
        shortLabel: "2",
        quantity: "2 camisetas",
        details: "Selecao estampada da Black Antecipada.",
        originalPrice: "R$ 199,80",
        promoPrice: "R$ 185,90",
        savings: "R$ 13,90",
        pricePerShirt: "R$ 92,95",
      },
      {
        id: "estampadas-4",
        title: "4 camisetas",
        shortLabel: "4",
        quantity: "4 camisetas",
        details: "Mais opcoes estampadas no mesmo combo.",
        originalPrice: "R$ 399,60",
        promoPrice: "R$ 359,90",
        savings: "R$ 39,70",
        pricePerShirt: "R$ 89,98",
      },
      {
        id: "estampadas-5",
        title: "5 camisetas",
        shortLabel: "5",
        quantity: "5 camisetas",
        details: "Combo completo para quem quer mais estampas.",
        originalPrice: "R$ 499,50",
        promoPrice: "R$ 439,90",
        savings: "R$ 59,60",
        pricePerShirt: "R$ 87,98",
      },
    ],
  },
];

const JOURNEY_STEPS = ["Grupo VIP", "Escolhe o combo", "WhatsApp", "Atendimento"] as const;
const DEFAULT_SELECTED_OFFERS: Record<ComboCategoryKey, string> = {
  minimalistas: "minimalistas-2",
  mescladas: "mescladas-2",
  estampadas: "estampadas-2",
};

export function BlackLandingClient({
  whatsappPhone,
  catalogCategories,
}: BlackLandingClientProps) {
  const searchParams = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<ComboCategoryKey>("minimalistas");
  const [selectedOfferByCategory, setSelectedOfferByCategory] =
    useState<Record<ComboCategoryKey, string>>(DEFAULT_SELECTED_OFFERS);
  const [selectedProductsByOffer, setSelectedProductsByOffer] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [isRedirectingOfferId, setIsRedirectingOfferId] = useState("");
  const [galleryProduct, setGalleryProduct] = useState<BlackLandingCatalogProduct | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryImages = galleryProduct ? getProductGalleryImages(galleryProduct) : [];

  const trackingContext = useMemo(
    () => ({
      utmSource: searchParams.get("utm_source") ?? "",
      utmMedium: searchParams.get("utm_medium") ?? "",
      utmCampaign: searchParams.get("utm_campaign") ?? "",
      utmContent: searchParams.get("utm_content") ?? "",
      utmTerm: searchParams.get("utm_term") ?? "",
    }),
    [searchParams],
  );

  const activeCategoryData =
    COMBO_CATEGORIES.find((category) => category.key === activeCategory) ?? COMBO_CATEGORIES[0];
  const activeCatalogCategory =
    catalogCategories.find((category) => category.key === activeCategory) ?? null;
  const activeOfferId = selectedOfferByCategory[activeCategory] ?? activeCategoryData.offers[0].id;
  const activeOffer =
    activeCategoryData.offers.find((offer) => offer.id === activeOfferId) ??
    activeCategoryData.offers[0];
  const activeOfferSelection = activeCatalogCategory?.offerSelections[activeOffer.id] ?? null;
  const isActiveOfferReady = activeOfferSelection
    ? isOfferSelectionReady(activeOffer.id, activeOfferSelection, selectedProductsByOffer)
    : false;
  const whatsappBaseUrl = useMemo(() => buildWhatsappBaseUrl(whatsappPhone), [whatsappPhone]);

  useEffect(() => {
    const visitorId = getOrCreateVisitorId();
    const now = Date.now();
    const lastTrackedAt = Number(window.localStorage.getItem(VIEW_STORAGE_KEY) ?? "0");

    if (now - lastTrackedAt < VIEW_DEDUP_WINDOW_MS) {
      return;
    }

    window.localStorage.setItem(VIEW_STORAGE_KEY, String(now));

    void sendTrackingEvent({
      eventType: "view",
      visitorId,
      landingSlug: LANDING_SLUG,
      pageUrl: window.location.href,
      referrerUrl: document.referrer,
      targetUrl: whatsappBaseUrl,
      ...trackingContext,
    });
  }, [trackingContext, whatsappBaseUrl]);

  useEffect(() => {
    if (!galleryProduct) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeGallery();
        return;
      }

      if (event.key === "ArrowLeft") {
        showPrevGalleryImage();
        return;
      }

      if (event.key === "ArrowRight") {
        showNextGalleryImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryImages.length, galleryProduct]);

  function handleSelectOffer(categoryKey: ComboCategoryKey, offerId: string) {
    setSelectedOfferByCategory((current) => ({
      ...current,
      [categoryKey]: offerId,
    }));
  }

  function handleToggleProduct(
    offerId: string,
    group: BlackLandingSelectionGroup,
    product: BlackLandingCatalogProduct,
  ) {
    setSelectedProductsByOffer((current) => {
      const offerSelections = current[offerId] ?? {};
      const selectedIds = offerSelections[group.id] ?? [];
      const isSelected = selectedIds.includes(product.productId);

      let nextIds = selectedIds;

      if (isSelected) {
        nextIds = selectedIds.filter((id) => id !== product.productId);
      } else if (group.requiredQuantity > 0 && selectedIds.length >= group.requiredQuantity) {
        nextIds = [...selectedIds.slice(1), product.productId];
      } else {
        nextIds = [...selectedIds, product.productId];
      }

      return {
        ...current,
        [offerId]: {
          ...offerSelections,
          [group.id]: nextIds,
        },
      };
    });
  }

  function openGallery(product: BlackLandingCatalogProduct, startIndex = 0) {
    const images = getProductGalleryImages(product);

    if (!images.length) {
      return;
    }

    setGalleryProduct(product);
    setGalleryIndex(Math.min(startIndex, images.length - 1));
  }

  function closeGallery() {
    setGalleryProduct(null);
    setGalleryIndex(0);
  }

  function showPrevGalleryImage() {
    if (!galleryProduct || galleryImages.length <= 1) {
      return;
    }

    setGalleryIndex((current) => (current === 0 ? galleryImages.length - 1 : current - 1));
  }

  function showNextGalleryImage() {
    if (!galleryProduct || galleryImages.length <= 1) {
      return;
    }

    setGalleryIndex((current) => (current === galleryImages.length - 1 ? 0 : current + 1));
  }

  async function handleOfferClick(category: ComboCategory, offer: ComboOffer) {
    handleSelectOffer(category.key, offer.id);

    const categoryConfig = catalogCategories.find((item) => item.key === category.key) ?? null;
    const offerSelection = categoryConfig?.offerSelections[offer.id] ?? null;

    if (offerSelection && !isOfferSelectionReady(offer.id, offerSelection, selectedProductsByOffer)) {
      document.getElementById(SELECTION_SECTION_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const targetUrl = buildWhatsappLink(
      whatsappPhone,
      category,
      offer,
      offerSelection,
      selectedProductsByOffer[offer.id] ?? {},
    );

    setIsRedirectingOfferId(offer.id);

    try {
      await sendTrackingEvent({
        eventType: "click",
        visitorId: getOrCreateVisitorId(),
        landingSlug: LANDING_SLUG,
        pageUrl: window.location.href,
        referrerUrl: document.referrer,
        targetUrl,
        ...trackingContext,
      });
    } finally {
      window.location.assign(targetUrl);
    }
  }

  return (
    <main className={styles.page} style={PAGE_BACKGROUND_STYLE}>
      <div className={styles.backgroundGlowLeft} aria-hidden="true" />
      <div className={styles.backgroundGlowRight} aria-hidden="true" />

      <section className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.badge}>Repeticao Maxima . Acesso VIP</div>
          <h1 className={styles.title}>BLACK ANTECIPADA</h1>
          <p className={styles.description}>
            Escolha seu combo e fale com o time no WhatsApp para fechar direto pelo grupo.
          </p>
        </header>

        <section className={styles.catalogSection}>
          <div className={styles.tabRow} role="tablist" aria-label="Categorias de combo">
            {COMBO_CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                role="tab"
                aria-selected={category.key === activeCategory}
                className={`${styles.tabButton} ${
                  category.key === activeCategory ? styles.tabButtonActive : ""
                }`}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className={styles.categoryHeader}>
            <div>
              <p className={styles.categoryEyebrow}>{activeCategoryData.eyebrow}</p>
              <h2 className={styles.categoryTitle}>{activeCategoryData.label}</h2>
              <p className={styles.categoryDescription}>{activeCategoryData.description}</p>
            </div>
            <div className={styles.categoryHighlight}>{activeCategoryData.highlight}</div>
          </div>

          <div className={styles.offerGrid}>
            {activeCategoryData.offers.map((offer) => {
              const isActiveOffer = activeOfferId === offer.id;
              const offerSelection = activeCatalogCategory?.offerSelections[offer.id] ?? null;
              const isReady = offerSelection
                ? isOfferSelectionReady(offer.id, offerSelection, selectedProductsByOffer)
                : false;

              return (
                <article
                  key={offer.id}
                  className={`${styles.offerCard} ${isActiveOffer ? styles.offerCardActive : ""}`}
                >
                  <div className={styles.offerTop}>
                    <div className={styles.offerBadge}>{offer.shortLabel}</div>
                    <div>
                      <h3 className={styles.offerTitle}>{offer.title}</h3>
                      <p className={styles.offerSubtitle}>{offer.details}</p>
                    </div>
                  </div>

                  <div className={styles.priceBlock}>
                    <p className={styles.originalPrice}>De {offer.originalPrice}</p>
                    <p className={styles.priceLabel}>Por</p>
                    <p className={styles.promoPrice}>{offer.promoPrice}</p>
                  </div>

                  <div className={styles.metaRow}>
                    <div className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Economia</span>
                      <strong>{offer.savings}</strong>
                    </div>
                    <div className={styles.metaChip}>
                      <span className={styles.metaChipLabel}>Por camiseta</span>
                      <strong>{offer.pricePerShirt}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.offerButton}
                    onClick={() => {
                      if (!isActiveOffer) {
                        handleSelectOffer(activeCategoryData.key, offer.id);
                        document.getElementById(SELECTION_SECTION_ID)?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                        return;
                      }

                      void handleOfferClick(activeCategoryData, offer);
                    }}
                  >
                    {isRedirectingOfferId === offer.id
                      ? "ABRINDO WHATSAPP..."
                      : !isActiveOffer
                        ? "ESCOLHER ESSE COMBO"
                        : offerSelection && !isReady
                          ? "SELECIONAR AS PECAS"
                          : "QUERO ESSE COMBO"}
                  </button>
                </article>
              );
            })}
          </div>

          <section id={SELECTION_SECTION_ID} className={styles.realCatalogSection}>
            <div className={styles.realCatalogHeader}>
              <div>
                <p className={styles.realCatalogEyebrow}>Monte seu combo</p>
                <h3 className={styles.realCatalogTitle}>
                  {activeOfferSelection
                    ? `Selecione as pecas do combo de ${activeOffer.quantity.toLowerCase()}`
                    : `Veja todas as pecas de ${activeCategoryData.label}`}
                </h3>
                <p className={styles.realCatalogDescription}>
                  {activeOfferSelection
                    ? buildSelectionDescription(activeOfferSelection)
                    : activeCatalogCategory?.configured
                      ? "As fotos abaixo seguem o mapeamento configurado no painel para essa categoria."
                      : "Assim que a regra dessa categoria estiver pronta no painel, as pecas aparecem aqui automaticamente."}
                </p>
              </div>
            </div>

            {activeOfferSelection ? (
              <div className={styles.selectionGroupList}>
                {activeOfferSelection.groups.map((group) => {
                  const selectedIds = selectedProductsByOffer[activeOffer.id]?.[group.id] ?? [];

                  return (
                    <section key={group.id} className={styles.selectionGroupSection}>
                      <div className={styles.selectionGroupHeader}>
                        <div>
                          <h4 className={styles.selectionGroupTitle}>{group.label}</h4>
                          <p className={styles.selectionGroupDescription}>
                            Escolha {group.requiredQuantity} peca(s) deste bloco.
                          </p>
                        </div>
                        <div className={styles.selectionCounter}>
                          {selectedIds.length}/{group.requiredQuantity}
                        </div>
                      </div>

                      <div className={styles.productGrid}>
                        {group.products.map((product) => {
                          const isSelected = selectedIds.includes(product.productId);
                          const productImages = getProductGalleryImages(product);
                          const previewImageUrl = productImages[0] ?? null;

                          return (
                            <article
                              key={`${group.id}-${product.productId}`}
                              className={`${styles.productCardButton} ${
                                isSelected ? styles.productCardSelected : ""
                              }`}
                            >
                              <button
                                type="button"
                                className={styles.productImageButton}
                                onClick={() => openGallery(product)}
                                aria-label={`Ver fotos de ${product.productName}`}
                              >
                                {isSelected ? <span className={styles.selectedPill}>Selecionada</span> : null}
                                {productImages.length > 1 ? (
                                  <span className={styles.productMediaBadge}>
                                    +{productImages.length - 1} foto{productImages.length - 1 > 1 ? "s" : ""}
                                  </span>
                                ) : null}
                                {previewImageUrl ? (
                                  <img
                                    src={previewImageUrl}
                                    alt={product.productName}
                                    className={styles.productImage}
                                  />
                                ) : (
                                  <div className={styles.productImageFallback}>RM</div>
                                )}
                              </button>
                              <div className={styles.productCardBody}>
                                <div className={styles.productName}>{product.productName}</div>
                                <div className={styles.productActionRow}>
                                  <button
                                    type="button"
                                    className={styles.productGalleryButton}
                                    onClick={() => openGallery(product)}
                                    disabled={!productImages.length}
                                  >
                                    {productImages.length > 1 ? "VER FOTOS" : "AMPLIAR FOTO"}
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.productSelectButton} ${
                                      isSelected ? styles.productSelectButtonActive : ""
                                    }`}
                                    onClick={() => handleToggleProduct(activeOffer.id, group, product)}
                                  >
                                    {isSelected ? "REMOVER" : "SELECIONAR"}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}

                <div className={styles.selectionActionBar}>
                  <div className={styles.selectionActionCopy}>
                    <strong>Pedido pronto para enviar</strong>
                    <span>
                      {isOfferSelectionReady(
                        activeOffer.id,
                        activeOfferSelection,
                        selectedProductsByOffer,
                      )
                        ? "Vamos abrir o WhatsApp com o combo e as pecas escolhidas ja preenchidas."
                        : "Selecione todas as pecas obrigatorias acima para liberar a finalizacao."}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.selectionActionButton}
                    disabled={
                      isRedirectingOfferId === activeOffer.id ||
                      !isActiveOfferReady
                    }
                    onClick={() => void handleOfferClick(activeCategoryData, activeOffer)}
                  >
                    {isRedirectingOfferId === activeOffer.id
                      ? "ABRINDO WHATSAPP..."
                      : "FINALIZAR COMPRA NO WHATSAPP"}
                  </button>
                </div>
              </div>
            ) : activeCatalogCategory?.products.length ? (
              <div className={styles.productGrid}>
                {activeCatalogCategory.products.map((product) => {
                  const productImages = getProductGalleryImages(product);
                  const previewImageUrl = productImages[0] ?? null;

                  return (
                    <article key={product.productId} className={styles.productCard}>
                      <button
                        type="button"
                        className={styles.productImageButton}
                        onClick={() => openGallery(product)}
                        aria-label={`Ver fotos de ${product.productName}`}
                      >
                        {productImages.length > 1 ? (
                          <span className={styles.productMediaBadge}>
                            +{productImages.length - 1} foto{productImages.length - 1 > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {previewImageUrl ? (
                          <img
                            src={previewImageUrl}
                            alt={product.productName}
                            className={styles.productImage}
                          />
                        ) : (
                          <div className={styles.productImageFallback}>RM</div>
                        )}
                      </button>
                      <div className={styles.productCardBody}>
                        <div className={styles.productName}>{product.productName}</div>
                        <button
                          type="button"
                          className={styles.productGalleryButton}
                          onClick={() => openGallery(product)}
                          disabled={!productImages.length}
                        >
                          {productImages.length > 1 ? "VER TODAS AS FOTOS" : "AMPLIAR FOTO"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyCatalogState}>
                Nenhuma peca valida encontrada para essa categoria nas regras da Black.
              </div>
            )}

            {activeOfferSelection &&
            isActiveOfferReady ? (
              <div className={styles.selectionReadyBar}>
                Combo pronto. Toque em <strong>FINALIZAR COMPRA NO WHATSAPP</strong> para enviar o
                pedido ja preenchido com as pecas escolhidas.
              </div>
            ) : null}
          </section>
        </section>

        <section className={styles.journeySection}>
          <h2>Como funciona</h2>
          <div className={styles.journeyRow}>
            {JOURNEY_STEPS.map((step, index) => (
              <div key={step} className={styles.journeyItem}>
                <div className={styles.journeyIcon}>{index + 1}</div>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <p className={styles.journeyNote}>
            Ao tocar em qualquer combo, o WhatsApp ja abre com a mensagem pronta para o time
            finalizar seu pedido.
          </p>
        </section>
      </section>

      {activeOfferSelection && isActiveOfferReady ? (
        <div className={styles.floatingCheckoutBar}>
          <div className={styles.floatingCheckoutCopy}>
            <strong>Combo escolhido</strong>
            <span>
              {activeCategoryData.label} • {activeOffer.quantity} • {activeOffer.promoPrice}
            </span>
          </div>
          <button
            type="button"
            className={styles.floatingCheckoutButton}
            onClick={() => void handleOfferClick(activeCategoryData, activeOffer)}
          >
            {isRedirectingOfferId === activeOffer.id
              ? "ABRINDO WHATSAPP..."
              : "FINALIZAR COMPRA PELO WHATSAPP"}
          </button>
        </div>
      ) : null}

      {galleryProduct && galleryImages.length ? (
        <div
          className={styles.galleryOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Galeria de fotos de ${galleryProduct.productName}`}
          onClick={closeGallery}
        >
          <div className={styles.galleryModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.galleryHeader}>
              <div className={styles.galleryHeaderCopy}>
                <strong>{galleryProduct.productName}</strong>
                <span>
                  Foto {galleryIndex + 1} de {galleryImages.length}
                </span>
              </div>
              <button
                type="button"
                className={styles.galleryCloseButton}
                onClick={closeGallery}
                aria-label="Fechar galeria"
              >
                FECHAR
              </button>
            </div>

            <div className={styles.galleryStage}>
              {galleryImages.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.galleryNavButton} ${styles.galleryNavPrev}`}
                  onClick={showPrevGalleryImage}
                  aria-label="Foto anterior"
                >
                  ‹
                </button>
              ) : null}

              <img
                src={galleryImages[galleryIndex]}
                alt={`${galleryProduct.productName} - foto ${galleryIndex + 1}`}
                className={styles.galleryStageImage}
              />

              {galleryImages.length > 1 ? (
                <button
                  type="button"
                  className={`${styles.galleryNavButton} ${styles.galleryNavNext}`}
                  onClick={showNextGalleryImage}
                  aria-label="Proxima foto"
                >
                  ›
                </button>
              ) : null}

              <div className={styles.galleryCounter}>
                {galleryIndex + 1}/{galleryImages.length}
              </div>
            </div>

            {galleryImages.length > 1 ? (
              <div className={styles.galleryThumbRow}>
                {galleryImages.map((imageUrl, index) => (
                  <button
                    key={`${galleryProduct.productId}-${index}`}
                    type="button"
                    className={`${styles.galleryThumbButton} ${
                      index === galleryIndex ? styles.galleryThumbActive : ""
                    }`}
                    onClick={() => setGalleryIndex(index)}
                    aria-label={`Abrir foto ${index + 1}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${galleryProduct.productName} miniatura ${index + 1}`}
                      className={styles.galleryThumbImage}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function buildSelectionDescription(selection: BlackLandingOfferSelection) {
  return selection.groups
    .map((group) => `${group.requiredQuantity}x ${group.label}`)
    .join(", ");
}

function isOfferSelectionReady(
  offerId: string,
  selection: BlackLandingOfferSelection,
  selectedProductsByOffer: Record<string, Record<string, string[]>>,
) {
  return selection.groups.every((group) => {
    const selectedIds = selectedProductsByOffer[offerId]?.[group.id] ?? [];
    return selectedIds.length === group.requiredQuantity;
  });
}

function buildWhatsappBaseUrl(whatsappPhone: string) {
  const normalizedPhone = whatsappPhone.replace(/\D/g, "");
  return normalizedPhone ? `https://wa.me/${normalizedPhone}` : "";
}

function buildWhatsappLink(
  whatsappPhone: string,
  category: ComboCategory,
  offer: ComboOffer,
  selection: BlackLandingOfferSelection | null,
  selectedProducts: Record<string, string[]>,
) {
  const baseUrl = buildWhatsappBaseUrl(whatsappPhone);
  const lines = [
    "Oi! Vim da landing Black Antecipada.",
    `Quero o combo ${category.label} com ${offer.quantity.toLowerCase()} por ${offer.promoPrice}.`,
    `Detalhes: ${offer.details}`,
  ];

  if (selection) {
    lines.push("Pecas escolhidas:");

    for (const group of selection.groups) {
      const ids = selectedProducts[group.id] ?? [];
      const names = ids
        .map((id) => group.products.find((product) => product.productId === id)?.productName)
        .filter(Boolean);

      if (names.length > 0) {
        lines.push(`- ${group.label}: ${names.join(", ")}`);
      }
    }
  }

  return `${baseUrl}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function getProductGalleryImages(product: BlackLandingCatalogProduct | null) {
  if (!product) {
    return [];
  }

  return Array.from(new Set([...(product.imageUrls ?? []), product.imageUrl ?? ""].filter(Boolean)));
}

function getOrCreateVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId = `black_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
  return nextId;
}

async function sendTrackingEvent(payload: TrackingPayload) {
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const sent = navigator.sendBeacon(TRACK_ENDPOINT, blob);

    if (sent) {
      return;
    }
  }

  await fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}




