# ZAYOU — audit (25/10/2026) and open items

All findings come from the public storefront (`zayou-5.myshopify.com`) and its JSON endpoints. Admin access was not available, so checkout settings, payment gateways, apps without a storefront footprint and analytics settings were not inspected.

## Verified state of the live store
- **Theme**: Prestige 8.1.2 (`theme_store_id: null`, uploaded copy), FR only, MAD, money format `{{amount}} dh`.
- **Catalogue**: 164 products. 84 baskets, 31 sandales, 11 mocassins (no product type set), 4 sabots, 3 bottines, 28 parfums, plus 3 products in no collection (`bonplan-911`, `mocassins-souple-noir`, `chaussure-de-ville-premium`).
- **Variants are sizes only**: 39–45, mostly 40–43. The option is named `Taille`, `Pointure` (sabots) or `Pointures` (bottines). **Colours are separate products.**
- **Photography**: white or light-grey packshots, mostly square, plus a few worn shots. The mocassins also have shots on a marble backdrop. No lifestyle or campaign imagery exists.
- **Collections**: `all-in` ("best sellers" in the menu), `baskets-broski`, `chaussures-de-ville-homme` and `chaussures-classique-homme` are **empty**. The menu and homepage link to two of them.
- **Ordering**: EasySell COD Form (app embed, popup, `hide_atc` and `hidebuy` on, sticky button on, placement on product + cart). It falls back to the **first variant** when the form has no variant. The new theme blocks its button until a size is chosen (tested with the app's real `helpers.js`).
- **Tracking**: Meta pixel 1079897577123417 through Shopify Web Pixels (theme-independent, unaffected). No GTM, GA or TikTok tag found in the theme.
- **Policies**: only the privacy policy is published. Refund, shipping and terms return 404.
- **Pages / blog**: `/pages/contact`, plus the blog `infos` with 3 leather articles.

## Contradictions and data issues (owner decision needed)
1. **Delivery**: the homepage says "1 à 4 jours après confirmation". EasySell says "1-3 Jours", 30 dh below 498 dh and free from 499 dh, while its form header says "gratuite à partir de 500 DHS". Shopify checkout shows "Standard 0.00" for Morocco. The theme only says "Livraison partout au Maroc" until one rule is confirmed. The free-shipping bar is off (setting empty).
2. **Payment**: the homepage claims card payment. Only COD is verifiable, so only COD is mentioned.
3. **Social links** point to *Bon Plan Maroc* accounts. They are kept for continuity (theme settings) and should be replaced with ZAYOU accounts.
4. **Two phone numbers**: WhatsApp +212633909991 (floating button) and tel. +212 644-522326 (footer). Both are kept.
5. **Product data**:
   - `basket-homme-021-cuir-noir`: price 600 > compare-at 519 (the theme hides the false "sale").
   - `basket-homme-023-cuir-marron` is titled "Basket Homme **024**".
   - Crest Tabac's description says "coloris Marron".
   - The perfume descriptions contain pasted WooCommerce/Bootstrap HTML (axe: invalid ARIA, heading order).
   - Mocassins have no product type (and `basket-04` « Basket Daim Vert » has none either, so recommendations group it with the mocassins).
   - Eclipse **Beige** description says « en Vert »; most mocassin descriptions are just « MOCASSINS SOUPLE NEW 2025 ».
6. **Third-party marks in products/photos**: "L@coste simple" (2 products) imitates a protected brand name, and the *Premium Leather 008* sandal photos show an embossed eagle resembling a well-known fashion house's logo. Check the rights; the theme never features them editorially.
7. **Vendor** "Bon Plan Maroc / BONPLAN / Bon Plan" is hidden on cards and product pages (setting). "Broski" is shown as a line name.

## Missing to complete the experience
- **Size guide** with real measurements (foot length per size). The size-guide link only appears once a page is chosen in the settings.
- **Exchange/return policy** and **shipping policy**, to publish in Shopify. The product page shows them automatically once a page is chosen.
- **Brand story**: founding, origin, manufacturing. Nothing verified exists, so none is written.
- **Lifestyle/campaign photos**: the hero supports a full-bleed photo layout once one exists.
- **Materials per product**: the descriptions mix "cuir" in titles with "cuir synthétique" in specs (e.g. Crest). They need confirming before any material badge or filter.
- **ZAYOU social accounts** and a contact email.
- **Menu decision** for "best sellers" (empty), and whether Parfums stays in the main navigation.

## Optional data improvement
`migration/colorways-metafields.csv` (Matrixify) writes `zayou.colorway`, `zayou.material` and `zayou.siblings` for 134 products, derived from titles. **Review the groupings first.** For example, "Basket Homme 006" groups 13 products, including the ST/SN/SB variants, whose meaning is unknown. Once imported, the metafields drive colourways instead of the generated map, and a colour filter can be added in Search & Discovery.

## v2 (26/10/2026) — content and imagery
- New pages built only from verified facts and general care/styling know-how: À propos, Guide des pointures (measuring method + sizes per category computed from the catalogue), Conseils d’entretien, Inspirations, FAQ, Contact. **No delivery times, return/exchange terms or size-measurement chart are published** — these need the owner (the size guide has a hidden slot for verified measurements).
- No AI image was generated (no generation tool available). All imagery is the store’s own photography; prompts and slots for the missing campaign images are in `docs/ai-visual-brief.md`.
- Product-page galleries show the original photos unchanged (verified by test: original files, natural ratio, no crop, no blending, no rounding).
