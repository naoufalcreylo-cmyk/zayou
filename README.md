# ZAYOU — new Shopify storefront

New Online Store 2.0 theme for **zayou-5.myshopify.com**, written from scratch (no paid theme code).
The live theme today is Prestige 8.1.2, an uploaded copy with no Theme Store link. It is left untouched.

```
theme/              the Shopify theme (upload as zayou-theme.zip)
zayou-theme.zip     theme/ zipped for Admin › Online Store › Themes › Add theme › Upload zip
research/           live-store exports used for the audit (25/10/2026): products, collections, pages, EasySell config + helpers.js
data/               catalog.json (preview data), colorways.json (colourways derived from titles)
migration/          colorways-metafields.csv (optional, Matrixify)
tools/              preview server, generators, QA scripts
qa/shots/           screenshots
```

## Run the local preview
`node tools/preview/server.js 4300` and then open http://localhost:4300. The preview runs the **real theme Liquid** on the real catalogue: 164 products, real collection membership and real Shopify CDN images. It emulates the Ajax cart, Section Rendering, predictive search, recommendations and filters. Checkout and apps are not emulated.
- Filters default to the **recommended** Search & Discovery setup (size, type, brand, availability, price). `ZY_LIVE_FILTERS=1` shows what the store has today (availability + price only).

## QA commands
| Command | What it checks |
|---|---|
| `node tools/theme-check.js` | Shopify Theme Check (official), whole theme |
| `node tools/links.js` | crawls every internal link and anchor (no dead links) |
| `node tools/flows.js` | 57 interaction tests: size rules, cart, filters, load-more/back, quick add, search, mobile, **EasySell compatibility with the app's real helpers.js** |
| `node tools/sweep.js` | 20 pages × 360/390/768/1024/1440: overflow, touch targets, axe-core |
| `node tools/perf.js` | throttled mobile LCP/CLS and asset weights |

## Regenerate after catalogue changes
`node tools/build-catalog.js && node tools/gen-colorways.js` refreshes `snippets/colorway-data.liquid`, the fallback colourway map. Before that, refresh `research/products.json` and `research/c-*.json` from the store's `/products.json` and `/collections/<handle>/products.json`. When products carry the `zayou.colorway` / `zayou.siblings` metafields, those take priority over the map.

## Before publishing (admin steps, in order)
1. **Upload** `zayou-theme.zip` as an *unpublished* theme, or use `shopify theme push --unpublished`.
2. **EasySell**: the app embed is pre-enabled in `settings_data.json`. Confirm it under *Customize › App embeds*. Then on the preview, place a test COD order: no size chosen must be blocked, and the chosen size must be the ordered one.
3. **Search & Discovery › Filters**: add the size option filter. The size option is named `Taille` on most products, `Pointure` on the sabots and `Pointures` on the bottines. Rename all of them to one name (e.g. `Pointure`), then set *Paramètres du thème › Pointures › Paramètre du filtre* to the matching param (`filter.v.option.pointure`). Without this filter, the homepage size finder and the size chips in collection toolbars have nothing to filter on.
4. **Menu**: "best sellers" points to `all-in`, an empty collection. The theme hides it, but it should be fixed or removed. "Accueil" is hidden by a header setting.
5. Check the theme-editor preview on a phone, then publish.

## Content pages (v2)
Their content lives in theme sections, editable in the theme editor. In Shopify admin, create one empty page per row and assign its template:

| Page handle | Title | Template |
|---|---|---|
| `a-propos` | À propos de zayou | `page.about` |
| `guide-des-pointures` | Guide des pointures | `page.size-guide` |
| `entretien` | Conseils d’entretien | `page.care` |
| `inspirations` | Inspirations | `page.style` |
| `faq` | Questions fréquentes | `page.faq` |
| `contact` (exists) | Contact | `page.contact` |

**Create these pages before publishing.** Footer links, guide cards and the product-page links use page pickers and hide themselves while a page is missing, but some editorial links point to the page URLs directly (collection editorial tiles, the homepage « Toutes nos inspirations » and « À propos » links, links inside FAQ answers) and would 404 until the pages exist.
Missing imagery and generation prompts: `docs/ai-visual-brief.md`.
