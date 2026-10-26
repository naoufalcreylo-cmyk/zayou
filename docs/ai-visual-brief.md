# ZAYOU — AI visual brief (assets still missing)

No image-generation tool was available in the environment used to build the site. **No AI image has been created or published.**
The site currently uses only the store's real product photography, curated and cropped outside product pages (worn shots, close-ups, lineups, the two warm loafer shots).
The theme is ready for the images below: each has an `image_picker` slot in the theme editor that takes priority over the product photo used today.

## Rules for every generated image
- **Real products only.** When an image shows a shoe sold on the site, give the generator the product's real photos as references (listed below). Keep its exact shape, colour, sole colour and thickness, stitching, hardware and visible branding (e.g. the BROSKI heel embossing). Do not depict a shoe that isn't in the catalogue as if it were for sale.
- **No invented facts:** no workshop, craftsman, factory, leather tannery, certificate, "handmade" cue or brand history.
- **No third-party logos** in the image (no visible brand marks other than those already on the product).
- **Art direction:** natural daylight, warm neutral palette (sand, warm white, wood, stone, light grey), restrained props (wood floor, linen, plaster wall, concrete step), clean composition with negative space. People cropped at the leg or torso, no faces needed. The palette should sit next to the white site and the two existing loafer shots (amber wall / wood floor).
- **Delivery:** JPG or WebP, at least 2400 px on the long side, sRGB. Upload in Shopify › Content › Files, then pick in the theme editor.

## Priority 1 — campaign and collection imagery
| # | Slot (theme editor) | Format | Product(s) shown | Prompt |
|---|---|---|---|---|
| 1 | Home › Hero › Image 1 + Image 2 (diptych) — replaces the two loafer shots each season | 2 × square, 2400 px | Mocassins souples daim (handles `mocassins-souples-en-daim-3`, `mocassins-souples-en-daim-bleu-marine`, `mocassins-souples-en-daim-7`) | "Editorial still life, autumn light through a window, a pair of soft unlined suede penny-less loafers with a light rubber sole [reference photos], one shoe tilted against a warm plaster wall, the other flat on pale oak parquet, soft long shadow, warm sand and amber palette, shot on medium format, 50 mm, f/4, no text, no logo." |
| 2 | Home › Hero (layout "Photo plein cadre") — alternative for the basket season | 16:9 landscape + 4:5 mobile | Basket Crest (5 colours: `crest-bleu`, `crest-cuir-noir`, `crest-kaki`, `crest-marron`, `crest-tabac`) | "Five low-top sneakers in khaki, navy, black, brown and tan matte finish with thick white cupsole [reference photos], aligned diagonally on a light concrete step, early morning side light, minimal composition with large negative space on the left for text, neutral warm grey palette, no people, no text." |
| 3 | Collection Mocassins › Introduction de collection › Image | square | `mocassins-souples-en-daim-9`, `mocassins-souples-en-daim-5` | "Close crop at ankle height of a man walking on a sunlit terracotta-tiled courtyard, wearing beige suede driving loafers with pebble sole [reference photos], light linen trousers cropped above the ankle, no socks visible, natural daylight, warm palette." |
| 4 | Collection Baskets › Introduction | square | `basket-homme-007-cuir-blanc` or `basket-homme-0011-cuir-blanc` | "White leather low-top sneaker [reference photos] worn with straight grey wool trousers ending just above the shoe, man stepping off a pale stone kerb, crisp daylight, city background softly blurred, cropped at the knee." |
| 5 | Collection Sandales › Introduction / Home › Styles › "les beaux jours" | square | `013-sandales-homme-en-cuir-noir`, `sandales-homme-009-daim-tabac` | "Black leather H-strap slide sandal [reference photos] worn with ecru linen trousers, bare feet on warm sand-coloured stone tiles beside a shadow of a palm leaf, midday Mediterranean light, no face." |
| 6 | Collection Bottines › Introduction / Home › Styles › "la bottine chelsea" | square | `bottine-homme-002-cuir-tabac`, `bottine-homme-001-cuir-noir-1` | "Tan leather chelsea boot with brown elastic side panel and chunky black rubber lug sole [reference photos], worn with raw indigo jeans with a single cuff, standing on wet dark cobblestones, overcast autumn light." |

## Priority 2 — editorial and brand pages
| # | Slot | Format | Product(s) | Prompt |
|---|---|---|---|---|
| 7 | Page À propos › En-tête › Image | square | a mix: Crest tabac, mocassin daim noir, sandale cuir noir, sabot gris | "Flat lay on warm white linen: four men's shoes arranged in a loose grid — tan sneaker, black suede loafer, black leather slide sandal, grey felt clog [reference photos] — top-down view, soft shadow, generous margins, calm and orderly, no text." |
| 8 | Page Entretien › En-tête / step "Daim et nubuck" | square | `mocassins-souples-en-daim-7` | "Still life of a tan suede loafer [reference photos] next to a natural bristle brush and a folded cotton cloth on a pale wood table, soft window light, no product labels or brand names visible on the care items." |
| 9 | Page Inspirations › each look (5 slots, "Image") | square | the products listed in each look | One image per look, same lighting set-up as #3–#6: cropped at the knee, outfit described in the look text (e.g. look 2: "chino beige raccourci, mocassin daim beige"). |
| 10 | Page Guide des pointures › step images | square | none (generic) | "Top-down photo of a bare foot standing on an A4 sheet against a white wall, pencil line marking the longest toe, wooden ruler alongside, clean bright light." — no product, so no reference needed. |

## Not to generate
- Product-page gallery images: **they stay the store's original photos** (the theme displays them unchanged).
- Any product that isn't in the catalogue, colours that don't exist, or "new collection" visuals for products not yet listed.
