// Local preview of the real theme Liquid (no Shopify store access available).
// node tools/preview/server.js [port=4200]  ·  env THEME_DIR=theme|theme-original
// Emulates: JSON templates + section groups, Section Rendering API (?section_id / sections), Ajax Cart API,
// predictive search, product recommendations, storefront filters/sort/pagination. Checkout is NOT emulated.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { URL } = require('url');
const { Drop } = require('liquidjs');
const D = require('./drops'); const { engine, translate, missing, loadLocales, THEME, loadJSON } = require('./engine');
const PORT = +process.argv[2] || 4200;
// Per-request context (the preview also runs as a Vercel function): origin from the request host, cart kept in a cookie
const { AsyncLocalStorage } = require('async_hooks'); const als = new AsyncLocalStorage();
const ctx = () => als.getStore() || { origin: `http://localhost:${PORT}`, cart: { items: [], note: '', attributes: {} } };
const origin = () => ctx().origin; const host = () => origin().replace(/^https?:\/\//, '');

// ---- static data -------------------------------------------------------------------------------
const MONEY = '{{amount}} dh'; // zayou-5 money format (ES_MONEY_FORMAT on the live store)
const shop = { name: 'Zayou.ma', get url() { return origin(); }, get secure_url() { return origin(); }, get domain() { return host(); }, permanent_domain: 'zayou-5.myshopify.com', money_format: MONEY, money_with_currency_format: MONEY + ' MAD',
  currency: 'MAD', locale: 'fr', description: '', email: null, phone: null, address: null, metafields: {}, policies: [], enabled_payment_types: [], 'customer_accounts_enabled': true, customer_accounts_optional: true,
  published_locales: [{ iso_code: 'fr', name: 'Français', primary: true, root_url: '/' }], products_count: D.catalog.products.length, collections_count: D.catalog.collections.length, brand: { logo: null, short_description: '', slogan: '' },
  privacy_policy: { title: 'Politique de confidentialité', url: '/policies/privacy-policy' }, refund_policy: null, shipping_policy: null, terms_of_service: null, contact_information: null, types: [...new Set(D.catalog.products.map(p => p.product_type))], vendors: [...new Set(D.catalog.products.map(p => p.vendor))],
  policies: [{ title: 'Politique de confidentialité', url: '/policies/privacy-policy', handle: 'privacy-policy' }], checkout: { guest_login: false }, password_message: '' };
const localization = { language: { iso_code: 'fr', name: 'Français', endonym_name: 'français', primary: true, root_url: '/' }, country: { iso_code: 'MA', name: 'Maroc', currency: { iso_code: 'MAD', symbol: 'د.م.', name: 'Dirham marocain' }, unit_system: 'metric', 'popular?': true },
  market: { handle: 'ma', id: 1 } };
localization.available_languages = [localization.language]; localization.available_countries = [localization.country];
const routes = { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update', cart_clear_url: '/cart/clear', predictive_search_url: '/search/suggest', product_recommendations_url: '/recommendations/products',
  search_url: '/search', all_products_collection_url: '/collections/all', collections_url: '/collections', account_url: '/account', account_login_url: '/account/login', account_register_url: '/account/register', account_logout_url: '/account/logout', account_addresses_url: '/account/addresses', account_recover_url: '/account/recover', storefront_login_url: '/account/login' };

// Menus: the live structure = NAV minus empty collections (see docs/navigation.md)
function link(title, url, links = [], object = null) { return { title, url, links, levels: links.length ? (links.some(l => l.links.length) ? 2 : 1) : 0, active: false, child_active: false, current: false, child_current: false, type: object ? 'collection_link' : 'http_link', object, handle: D.collectionByHandle && title ? require('./engine').engine && title.toLowerCase() : '' }; }
function buildLinklists() {
  // main-menu exactly as on zayou-5.myshopify.com (25/10/2026): Accueil, Sandales, Baskets, Bottines, Mocassins, Sabots, Parfums, best sellers (→ all-in, empty)
  const col = h => D.collectionByHandle[h] || null;
  const c = (title, h) => Object.assign(link(title, '/collections/' + h, [], col(h)), { type: 'collection_link' });
  const main = [Object.assign(link('Accueil', '/'), { type: 'frontpage_link' }), c('Sandales', 'sandales-homme'), c('Baskets', 'baskets-homme'), c('Bottines', 'bottines-homme'), c('Mocassins', 'mocassins-homme'), c('Sabots', 'sabot-homme'), c('Parfums', 'parfums'), c('best sellers', 'all-in')];
  const footer = [Object.assign(link('Rechercher', '/search'), { type: 'search_link' }), Object.assign(link('Contact', '/pages/contact'), { type: 'page_link' }), Object.assign(link('Conseils & entretien', '/blogs/infos'), { type: 'blog_link' })];
  const lists = { 'main-menu': { handle: 'main-menu', title: 'Menu principal', links: main }, footer: { handle: 'footer', title: 'Menu du pied de page', links: footer } };
  for (const l of Object.values(lists)) l.levels = l.links.some(x => x.links.length) ? 2 : 1;
  return lists;
}
const linklists = buildLinklists();
const PAGE = (id, handle, title, template_suffix) => ({ id, handle, title, url: '/pages/' + handle, template_suffix, content: '' });
const pages = { contact: PAGE(95380111425, 'contact', 'Contact', 'contact'), 'a-propos': PAGE(1, 'a-propos', 'À propos de zayou', 'about'), 'guide-des-pointures': PAGE(2, 'guide-des-pointures', 'Guide des pointures', 'size-guide'),
  entretien: PAGE(3, 'entretien', 'Conseils d’entretien', 'care'), inspirations: PAGE(4, 'inspirations', 'Inspirations', 'style'), faq: PAGE(5, 'faq', 'Questions fréquentes', 'faq') };
// blog "infos": real titles and excerpts from the live homepage; full article bodies were not exported
const ART = [
  ['les-differents-types-de-cuir-utilises-dans-la-fabrication-des-chaussures', 'Les Différents Types de Cuir Utilisés dans la Fabrication des Chaussures', 'Le cuir est un matériau privilégié dans la fabrication des chaussures en raison de sa durabilité, de son confort et de son esthétique. Il existe plusieurs types de cuir, chacun ayant des caractéri...'],
  ['comment-entretenir-vos-chaussures-en-cuir-pour-quelles-demeurent-comme-neuves', "Comment Entretenir Vos Chaussures en Cuir pour Qu'elles Demeurent Comme Neuves", "Investir dans une paire de chaussures en cuir de qualité est une décision judicieuse, mais pour en profiter pleinement, il est essentiel de bien les entretenir. Un entretien régulier permet non seu..."],
  ['les-chaussures-en-cuir-histoire-et-evolution', 'Les Chaussures en Cuir : Histoire et Évolution', "Les chaussures en cuir ont une longue histoire qui remonte à des milliers d'années. De simples sandales en cuir portées par nos ancêtres aux designs sophistiqués d'aujourd'hui, les chaussures en cu..."],
];
const ARTX = (() => { try { return require('../../data/articles.json'); } catch (e) { return {}; } })();
const articles = {}; const blogArticles = ART.map(([h, title, ex], i) => (articles['infos/' + h] = { id: i + 1, handle: h, title, url: '/blogs/infos/' + h, excerpt: ex, excerpt_or_content: ex, content: (ARTX[h] && ARTX[h].content) || '<p>' + ex + '</p>', published_at: '2024-10-24T10:00:00Z', image: ARTX[h] && ARTX[h].image ? new D.Img(ARTX[h].image, { width: 520, height: 500 }) : null, author: 'Zayou' }));
const blogs = { infos: { handle: 'infos', title: 'Conseils & entretien', url: '/blogs/infos', articles: blogArticles, articles_count: blogArticles.length } };

// ---- settings ----------------------------------------------------------------------------------
function loadSettings() {
  const schema = loadJSON(path.join(THEME, 'config/settings_schema.json')); const data = loadJSON(path.join(THEME, 'config/settings_data.json'));
  const cur = typeof data.current === 'string' ? data.presets[data.current] : data.current;
  const groupDef = schema.flatMap(g => g.settings || []).find(s => s.type === 'color_scheme_group');
  const schemes = []; for (const [id, sc] of Object.entries(cur.color_schemes || {})) { const vals = {}; for (const d of groupDef.definition) if (d.id) vals[d.id] = sc.settings[d.id] ?? d.default ?? ''; const s = new D.Scheme(id, vals); schemes.push(s); schemes[id] = s; }
  const ctx = { schemes, linklists, pages, articles, blogs };
  const settings = D.resolveSettings(schema.flatMap(g => g.settings || []).filter(s => s.type !== 'color_scheme_group'), cur, ctx);
  settings.color_schemes = schemes;
  return { settings, ctx, cur };
}

// ---- cart --------------------------------------------------------------------------------------
const variantIndex = {}; for (const p of Object.values(D.productByHandle)) for (const v of p.variants) variantIndex[v.id] = { p, v };
function lineDrop(it, i) { const { p, v } = variantIndex[it.variant_id];
  const img = v.featured_image || p.featured_image;
  return { key: `${v.id}:${i}`, id: v.id, variant_id: v.id, product_id: p.id, product: p, variant: v, title: p.has_only_default_variant ? p.title : `${p.title} - ${v.title}`, product_title: p.title, variant_title: p.has_only_default_variant ? null : v.title, quantity: it.quantity,
    price: v.price, original_price: v.price, final_price: v.price, line_price: v.price * it.quantity, original_line_price: v.price * it.quantity, final_line_price: v.price * it.quantity, total_discount: 0, discounts: [], line_level_discount_allocations: [], line_level_total_discount: 0,
    url: v.url, image: img, sku: v.sku, vendor: p.vendor, handle: p.handle, requires_shipping: true, gift_card: false, properties: it.properties || {}, options_with_values: p.has_only_default_variant ? [] : p.options.map((n, j) => ({ name: n, value: v['option' + (j + 1)] })),
    selling_plan_allocation: null, unit_price_measurement: null, item_components: [], product_type: p.type, index: i, url_to_remove: `/cart/change?line=${i + 1}&quantity=0` }; }
class Cart extends Drop {
  get items() { return ctx().cart.items.map(lineDrop); } get item_count() { return ctx().cart.items.reduce((a, i) => a + i.quantity, 0); }
  get total_price() { return this.items.reduce((a, i) => a + i.final_line_price, 0); } get items_subtotal_price() { return this.total_price; } get original_total_price() { return this.total_price; }
  get total_discount() { return 0; } get cart_level_discount_applications() { return []; } get discount_applications() { return []; } get note() { return ctx().cart.note; } get attributes() { return ctx().cart.attributes; }
  get currency() { return { iso_code: 'MAD' }; } get requires_shipping() { return this.item_count > 0; } get empty() { return !this.item_count; } get total_weight() { return 0; } get checkout_charge_amount() { return this.total_price; } get duties_included() { return false; } get taxes_included() { return true; }
  valueOf() { return this.item_count ? this : ''; }
  toJSON() { return { token: 'preview', note: this.note, attributes: this.attributes, original_total_price: this.total_price, total_price: this.total_price, total_discount: 0, total_weight: 0, item_count: this.item_count, items: this.items.map(lineJSON), requires_shipping: this.requires_shipping, currency: 'MAD', items_subtotal_price: this.total_price, cart_level_discount_applications: [] }; }
}
const lineJSON = l => ({ id: l.id, key: l.key, variant_id: l.variant_id, product_id: l.product_id, title: l.title, product_title: l.product_title, variant_title: l.variant_title, quantity: l.quantity, price: l.price, original_price: l.price, final_price: l.price, line_price: l.line_price, original_line_price: l.line_price, final_line_price: l.line_price, discounts: [], total_discount: 0, sku: l.sku, vendor: l.vendor, url: l.url, image: l.image?.src || null, featured_image: l.image ? { url: l.image.src, alt: l.image.alt, width: 1254, height: 1254, aspect_ratio: 1 } : null, handle: l.handle, requires_shipping: true, product_type: l.product_type, options_with_values: l.options_with_values, properties: l.properties, variant_options: l.variant.options, gift_card: false });
function cartAdd(id, qty, properties) { const e = variantIndex[+id]; if (!e) return { status: 404, message: 'Erreur', description: 'Produit introuvable' }; if (!e.v.available) return { status: 422, message: 'Erreur', description: `Le produit « ${e.p.title} » est épuisé.` };
  const ex = ctx().cart.items.find(i => i.variant_id === +id && JSON.stringify(i.properties || {}) === JSON.stringify(properties || {})); if (ex) ex.quantity += qty; else ctx().cart.items.push({ variant_id: +id, quantity: qty, properties: properties || {} });
  const idx = ctx().cart.items.findIndex(i => i.variant_id === +id); return lineDrop(ctx().cart.items[idx], idx); }
function cartSet(ref, qty) { let i = -1; if (typeof ref === 'string' && ref.includes(':')) i = ctx().cart.items.findIndex((it, j) => `${it.variant_id}:${j}` === ref); else if (ref?.line) i = ref.line - 1; else i = ctx().cart.items.findIndex(it => it.variant_id === +ref);
  if (i < 0 || i >= ctx().cart.items.length) return false; if (qty <= 0) ctx().cart.items.splice(i, 1); else ctx().cart.items[i].quantity = qty; return true; }

// ---- rendering ---------------------------------------------------------------------------------
const parseCache = new Map();
function parsed(file) { const st = fs.statSync(file); const c = parseCache.get(file); if (c && c.m === st.mtimeMs) return c; const src = fs.readFileSync(file, 'utf8');
  const sm = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/); const entry = { m: st.mtimeMs, tpl: engine.parse(src, file), schema: sm ? JSON.parse(sm[1]) : {} }; parseCache.set(file, entry); return entry; }
async function renderSection(G, type, id, data = {}, extra = {}, groupName = null, index = 1) {
  const file = path.join(THEME, 'sections', type + '.liquid'); if (!fs.existsSync(file)) return `<!-- missing section ${type} -->`;
  const { tpl, schema } = parsed(file);
  const settings = D.resolveSettings(schema.settings, data.settings || {}, G._sctx);
  const order = data.block_order || Object.keys(data.blocks || {});
  const blocks = order.map(k => [k, data.blocks[k]]).filter(([, b]) => b && !b.disabled).map(([k, b]) => { const bs = (schema.blocks || []).find(x => x.type === b.type) || {}; return { id: k, type: b.type, settings: D.resolveSettings(bs.settings, b.settings || {}, G._sctx), shopify_attributes: '' }; });
  const section = { id, type, settings, blocks, index, index0: index - 1, location: groupName || 'template' };
  let html; try { html = await engine.render(tpl, { section, ...extra }, { globals: Object.assign(Object.create(G), { section }) }); /* Shopify exposes `section` inside rendered snippets */ } catch (e) { console.error(`[${type}]`, e.message); html = `<pre style="color:#b00;white-space:pre-wrap">Liquid error in ${type}: ${String(e.message).replace(/</g, '&lt;')}</pre>`; }
  const tag = schema.tag || 'div';
  return `<${tag} id="shopify-section-${id}" class="shopify-section${groupName ? ' shopify-section-group-' + groupName : ''}${schema.class ? ' ' + schema.class : ''}">${html}</${tag}>`;
}
function groupData(name) { return loadJSON(path.join(THEME, 'sections', name + '.json')); }
async function renderGroup(G, name) { const g = groupData(name); const out = []; let i = 0; for (const k of g.order || Object.keys(g.sections)) { const s = g.sections[k]; if (!s || s.disabled) continue; out.push(await renderSection(G, s.type, `sections--1__${k}`, s, {}, name, ++i)); } return out.join('\n'); }
function templateData(name, suffix) { const f = path.join(THEME, 'templates', `${name}${suffix ? '.' + suffix : ''}.json`); return fs.existsSync(f) ? loadJSON(f) : loadJSON(path.join(THEME, 'templates', `${name}.json`)); }

// `collections`: iterable (non-empty ones, like the storefront) and addressable by handle
function collectionsGlobal() { const arr = Object.values(D.collectionByHandle).filter(c => c._handles.length && c.handle !== 'all' && !D.UNPUB(c.handle)); for (const [h, c] of Object.entries(D.collectionByHandle)) if (!D.UNPUB(h)) arr[h] = c; return arr; }
function globalsFor(req, url, extra) {
  const { settings, ctx } = loadSettings();
  const G = { settings, shop, routes, localization, linklists, pages, cart: new Cart(), collections: collectionsGlobal(), all_products: D.productByHandle, customer: null, images: {}, blogs, articles, metaobjects: {}, scripts: {},
    request: { host: host(), origin: origin(), path: url.pathname, page_type: extra.page_type, design_mode: false, visual_preview_mode: false, locale: localization.language },
    template: { name: extra.page_type, suffix: extra.suffix || null, directory: null, valueOf() { return extra.page_type + (extra.suffix ? '.' + extra.suffix : ''); }, toString() { return this.valueOf(); } },
    canonical_url: origin() + url.pathname, page_title: extra.title || shop.name, page_description: extra.description || '', current_page: +url.searchParams.get('page') || 1, current_tags: null, handle: extra.handle || '',
    content_for_header: `<script>window.Shopify=window.Shopify||{};Shopify.shop='${shop.permanent_domain}';Shopify.locale='fr';Shopify.currency={active:'MAD',rate:'1.0'};Shopify.country='MA';Shopify.designMode=false;Shopify.routes={root:'/'};</script>`,
    powered_by_link: '<a target="_blank" rel="nofollow" href="https://www.shopify.com">Propulsé par Shopify</a>', additional_checkout_buttons: false, content_for_additional_checkout_buttons: '',
    _query: Object.fromEntries([...new Set(url.searchParams.keys())].map(k => [k, url.searchParams.getAll(k).length > 1 ? url.searchParams.getAll(k) : url.searchParams.get(k)])), _sctx: ctx, ...extra.objects };
  G._renderGroup = n => renderGroup(G, n); G._renderStatic = n => renderSection(G, n, n, {}, {}, null);
  return G;
}

function route(url) {
  const p = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/'; let m;
  if (p === '/') return { page_type: 'index', title: shop.name };
  if (p === '/collections') return { page_type: 'list-collections', title: 'Collections' };
  if ((p === '/collections/vendors' || p === '/collections/types') && url.searchParams.get('q')) {
    const q = url.searchParams.get('q'); const key = p.endsWith('vendors') ? 'vendor' : 'type';
    const handles = Object.values(D.productByHandle).filter(x => String(x[key]).toLowerCase() === q.toLowerCase()).map(x => x.handle);
    const c = D.makeCollection({ handle: p.split('/').pop(), title: q, product_handles: handles }); c.url = p + '?q=' + encodeURIComponent(q);
    c._query = Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k !== 'q').map(k => [k, url.searchParams.getAll(k)])); c.sort_by = url.searchParams.get('sort_by') || '';
    c.filters = D.buildFilters(c, Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k.startsWith('filter.')).map(k => [k, url.searchParams.getAll(k)])), c.url);
    return { page_type: 'collection', title: q, handle: c.handle, objects: { collection: c } };
  }
  if ((m = p.match(/^\/collections\/([^/]+)$/))) { const c = D.collectionByHandle[m[1]]; if (!c) return null; c._query = Object.fromEntries([...new Set(url.searchParams.keys())].map(k => [k, url.searchParams.getAll(k)])); c.sort_by = url.searchParams.get('sort_by') || ''; c.filters = D.buildFilters(c, Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k.startsWith('filter.')).map(k => [k, url.searchParams.getAll(k)])), c.url);
    return { page_type: 'collection', title: c.title, handle: c.handle, suffix: c.template_suffix, objects: { collection: c } }; }
  if ((m = p.match(/^\/(?:collections\/[^/]+\/)?products\/([^/.]+)$/))) { const pr = D.productByHandle[m[1]]; if (!pr) return null; const vid = +url.searchParams.get('variant'); pr.selected_variant = pr.variants.find(v => v.id === vid) || null;
    // Shopify product options API: ?option_values=<option value ids> selects the variant with those values
    const ov = (url.searchParams.get('option_values') || '').split(',').filter(Boolean).map(Number);
    if (ov.length) { const wanted = pr.options.map((name, i) => [...new Set(pr.variants.map(v => v['option' + (i + 1)]))].find(val => ov.includes(D.hash(name + val))));
      pr.selected_variant = pr.variants.find(v => wanted.every((w, i) => !w || v['option' + (i + 1)] === w)) || pr.selected_variant; }
    return { page_type: 'product', title: pr.title, description: String(pr.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), handle: pr.handle, objects: { product: pr } }; }
  if (p === '/cart') return { page_type: 'cart', title: 'Votre panier' };
  if (p === '/search') return { page_type: 'search', title: 'Recherche', objects: { search: searchObj(url) } };
  if ((m = p.match(/^\/pages\/([^/]+)$/)) && pages[m[1]]) return { page_type: 'page', title: pages[m[1]].title, suffix: pages[m[1]].template_suffix, handle: m[1], objects: { page: pages[m[1]] } };
  if (p === '/blogs/infos') return { page_type: 'blog', title: blogs.infos.title, objects: { blog: blogs.infos } };
  if ((m = p.match(/^\/blogs\/infos\/([^/]+)$/)) && articles['infos/' + m[1]]) return { page_type: 'article', title: articles['infos/' + m[1]].title, objects: { blog: blogs.infos, article: articles['infos/' + m[1]] } };
  if (p === '/policies/privacy-policy') return { page_type: 'page', title: 'Politique de confidentialité', objects: { page: { title: 'Politique de confidentialité', content: '<p>(Contenu géré par Shopify — non simulé dans l\'aperçu.)</p>' } } };
  if (p === '/account' || p === '/account/login') return { page_type: 'customers/login', title: 'Connexion' };
  if (p === '/account/register') return { page_type: 'customers/register', title: 'Créer un compte' };
  return null;
}
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function searchProducts(q) { const t = norm(q).trim(); if (!t) return []; return Object.values(D.productByHandle).filter(p => t.split(/\s+/).every(w => norm([p.title, p.type, p.tags.join(' '), p.description].join(' ')).includes(w))); }
function searchObj(url) { const q = url.searchParams.get('q') || ''; const res = searchProducts(q).map(p => Object.assign(Object.create(p), { object_type: 'product' }));
  const fq = Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k.startsWith('filter.')).map(k => [k, url.searchParams.getAll(k)]));
  const pseudo = { all_products: res }; const filtered = D.applyFilters(res, fq);
  const s = { performed: !!q, terms: q, results_count: filtered.length, types: ['product'], filters: q ? D.buildFilters(pseudo, { ...fq, q }, '/search') : [], sort_by: url.searchParams.get('sort_by') || 'relevance', default_sort_by: 'relevance',
    sort_options: [{ value: 'relevance', name: 'Pertinence' }, { value: 'price-ascending', name: 'Prix : faible à élevé' }, { value: 'price-descending', name: 'Prix : élevé à faible' }] };
  const sorted = filtered.slice().sort({ 'price-ascending': (a, b) => a.price - b.price, 'price-descending': (a, b) => b.price - a.price }[s.sort_by] || (() => 0));
  Object.defineProperty(s, 'results', { get() { return this._paginate ? sorted.slice(this._paginate.offset, this._paginate.offset + this._paginate.by) : sorted; } }); return s; }

async function renderPage(req, url, info, status = 200) {
  const G = globalsFor(req, url, info);
  const tName = info.page_type; const tdata = templateData(tName, info.suffix);
  const order = tdata.order || Object.keys(tdata.sections); const parts = []; let i = 0;
  for (const k of order) { const s = tdata.sections[k]; if (!s || s.disabled) continue; parts.push(await renderSection(G, s.type, `template--1__${k}`, s, {}, null, ++i)); }
  const content = parts.join('\n');
  const { tpl } = parsed(path.join(THEME, 'layout', (tdata.layout || 'theme') + '.liquid'));
  let html = await engine.render(tpl, { content_for_layout: content }, { globals: G });
  return { status, html, G };
}
async function renderSectionById(req, url, id, info) {
  const G = globalsFor(req, url, info);
  let m = id.match(/^template--\d+__(.+)$/); if (m) { const t = templateData(info.page_type, info.suffix); const s = t.sections[m[1]]; if (s) return renderSection(G, s.type, id, s); }
  m = id.match(/^sections--\d+__(.+)$/); const key = m ? m[1] : id;
  for (const g of ['header-group', 'footer-group', 'overlay-group'].filter(n => fs.existsSync(path.join(THEME, 'sections', n + '.json')))) { const gd = groupData(g); if (gd.sections[key]) return renderSection(G, gd.sections[key].type, `sections--1__${key}`, gd.sections[key], {}, g); }
  const t = templateData(info.page_type, info.suffix); for (const [k, s] of Object.entries(t.sections)) if (s.type === key || k === key) return renderSection(G, s.type, `template--1__${k}`, s);
  return renderSection(G, key, key, {});
}

// ---- http --------------------------------------------------------------------------------------
function readBody(req) { return new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); }); }
function parseBody(buf, type = '') {
  const s = buf.toString('utf8'); if (!s) return {};
  if (type.includes('json')) return JSON.parse(s);
  if (type.includes('multipart')) { const b = '--' + type.split('boundary=')[1]; const o = {}; for (const part of s.split(b)) { const m = part.match(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n$/); if (m) setDeep(o, m[1], m[2]); } return o; }
  const o = {}; for (const [k, v] of new URLSearchParams(s)) setDeep(o, k, v); return o;
}
function setDeep(o, k, v) { const m = k.match(/^(\w+)\[(.*?)\](?:\[(.*?)\])?$/); if (!m) { o[k] = v; return; } o[m[1]] = o[m[1]] || (m[2] === '' || /^\d+$/.test(m[2]) ? [] : {}); if (m[3] !== undefined) { const i = +m[2]; o[m[1]][i] = o[m[1]][i] || {}; o[m[1]][i][m[3]] = v; } else if (m[2] === '') o[m[1]].push(v); else o[m[1]][m[2]] = v; }
const MIME = { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const COOKIE = 'zy_preview_cart';
function readCart(req) { const m = (req.headers.cookie || '').match(new RegExp(COOKIE + '=([^;]+)')); try { const c = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); return { items: (c.items || []).filter(i => variantIndex[i.variant_id]), note: c.note || '', attributes: c.attributes || {} }; } catch { return { items: [], note: '', attributes: {} }; } }
const cartCookie = () => `${COOKIE}=${Buffer.from(JSON.stringify(ctx().cart)).toString('base64url')}; Path=/; Max-Age=1209600; SameSite=Lax; HttpOnly`;
const send = (res, status, body, type = 'text/html; charset=utf-8', headers = {}) => { const c = als.getStore(); res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(process.env.VERCEL ? { 'X-Robots-Tag': 'noindex' } : {}), ...(c && c.dirty ? { 'Set-Cookie': cartCookie() } : {}), ...headers }); res.end(body); };
async function sectionsPayload(req, url, list, refererInfo) { const out = {}; for (const id of [].concat(list || []).flatMap(x => String(x).split(',')).filter(Boolean)) out[id] = await renderSectionById(req, url, id, refererInfo); return out; }
function refInfo(req) { try { const r = new URL(req.headers.referer || origin() + '/'); return route(r) || { page_type: 'index' }; } catch { return { page_type: 'index' }; } }

async function handler(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return als.run({ origin: `${proto}://${hostHeader}`, cart: readCart(req), dirty: false }, () => handle(req, res));
}
async function handle(req, res) {
  const url = new URL(req.url, origin()); const p = url.pathname;
  try {
    if (p.startsWith('/assets/') || p.startsWith('/shop_images/')) { const f = p.startsWith('/assets/') ? path.join(THEME, 'assets', path.basename(p)) : path.join(__dirname, 'shop_images', path.basename(p)); if (!fs.existsSync(f)) return send(res, 404, 'not found', 'text/plain'); return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream'); }
    if (p === '/__missing') return send(res, 200, [...missing].sort().join('\n'), 'text/plain; charset=utf-8');
    const json = (o, s = 200) => send(res, s, JSON.stringify(o), 'application/json; charset=utf-8');
    // Ajax Cart API
    if (p === '/cart.js' || (p === '/cart' && /json/.test(req.headers.accept || '') && req.method === 'GET')) return json(new Cart().toJSON());
    if (/^\/cart\/(add|change|update|clear)(\.js)?$/.test(p) && req.method === 'POST') {
      ctx().dirty = true; const body = parseBody(await readBody(req), req.headers['content-type']); const op = p.match(/cart\/(\w+)/)[1]; const isJs = p.endsWith('.js') || /json|javascript/.test(req.headers.accept || '') || req.headers['x-requested-with'];
      let out;
      if (op === 'add') { const items = body.items ? [].concat(body.items) : [{ id: body.id, quantity: body.quantity, properties: body.properties }]; const added = [];
        for (const it of items) { const r = cartAdd(it.id, +(it.quantity || 1), it.properties); if (r.status) return json(r, r.status); added.push(lineJSON(r)); } out = body.items ? { items: added } : added[0]; }
      if (op === 'change') { const qty = +body.quantity; const ok = cartSet(body.line ? { line: +body.line } : body.id, qty); if (!ok) return json({ status: 400, message: 'Erreur', description: 'Article introuvable' }, 400); out = new Cart().toJSON(); }
      if (op === 'update') { if (body.updates) for (const [k, q] of Object.entries(body.updates)) cartSet(Array.isArray(body.updates) ? { line: +k + 1 } : k, +q); if (body.note !== undefined) ctx().cart.note = body.note; if (body.attributes) Object.assign(ctx().cart.attributes, body.attributes); out = new Cart().toJSON(); }
      if (op === 'clear') { ctx().cart.items = []; out = new Cart().toJSON(); }
      if (body.sections) out.sections = await sectionsPayload(req, new URL(body.sections_url || '/', origin()), body.sections, refInfo(req));
      if (!isJs) return send(res, 302, '', 'text/plain', { Location: '/cart' });
      return json(out);
    }
    if (p === '/checkout' || p.startsWith('/checkouts')) return send(res, 200, '<!doctype html><meta charset=utf-8><title>Checkout</title><body style="font:16px system-ui;padding:40px"><h1>Checkout Shopify</h1><p>Le paiement est géré par Shopify et n\'est pas simulé dans l\'aperçu local.</p><p>Articles : ' + new Cart().item_count + '</p><a href="/cart">Retour au panier</a>');
    if (p === '/contact' && req.method === 'POST') { const body = parseBody(await readBody(req), req.headers['content-type']); const back = new URL(req.headers.referer || origin() + '/');
      const isCustomer = body.form_type === 'customer'; back.searchParams.set(isCustomer ? 'customer_posted' : 'contact_posted', 'true'); back.hash = isCustomer ? 'footer-newsletter' : 'contact-form';
      return send(res, 302, '', 'text/plain', { Location: back.pathname + back.search + back.hash }); }
    if (p === '/localization' && req.method === 'POST') return send(res, 302, '', 'text/plain', { Location: req.headers.referer || '/' });
    if ((p === '/search/suggest' || p === '/search/suggest.json')) {
      const q = url.searchParams.get('q') || ''; const prods = searchProducts(q).slice(0, +url.searchParams.get('resources[limit]') || 10);
      const cols = Object.values(D.collectionByHandle).filter(c => c._handles.length && norm(c.title).includes(norm(q)));
      const predictive_search = { performed: true, terms: q, resources: { products: prods, collections: cols, pages: [], articles: [], queries: q ? [{ text: q, styled_text: `<mark>${q}</mark>`, url: `/search?q=${encodeURIComponent(q)}` }] : [] } };
      const info = { page_type: 'search', objects: { predictive_search } }; const sid = url.searchParams.get('section_id');
      if (sid) return send(res, 200, await renderSectionById(req, url, sid, info));
      return json({ resources: { results: { products: prods.map(x => x.toJSON()) } } });
    }
    if (p === '/recommendations/products' || p === '/recommendations/products.json') {
      const pr = Object.values(D.productByHandle).find(x => x.id === +url.searchParams.get('product_id')); const intent = url.searchParams.get('intent') || 'related'; const limit = +url.searchParams.get('limit') || 10;
      // related = same product type (Shopify's automatic recommendations are based on purchase/type signals); complementary = merchant-configured only → empty
      const list = !pr || intent === 'complementary' ? [] : Object.values(D.productByHandle).filter(x => x.type === pr.type && x.id !== pr.id).slice(0, limit);
      const info = { page_type: 'product', objects: { product: pr, recommendations: { performed: true, products: list, products_count: list.length, intent } } };
      const sid = url.searchParams.get('section_id'); if (sid) return send(res, 200, await renderSectionById(req, url, sid, info));
      return json({ products: list.map(x => x.toJSON()) });
    }
    if ((p.match(/^\/products\/([^/]+)\.js$/))) { const pr = D.productByHandle[p.match(/^\/products\/([^/]+)\.js$/)[1]]; return pr ? json(pr.toJSON()) : json({}, 404); }
    let info = route(url); let status = 200;
    if (!info) { info = { page_type: '404', title: 'Page introuvable' }; status = 404; }
    if (url.searchParams.get('section_id')) return send(res, status, await renderSectionById(req, url, url.searchParams.get('section_id'), info));
    if (url.searchParams.get('sections')) return json(await sectionsPayload(req, url, url.searchParams.get('sections'), info));
    const r = await renderPage(req, url, info, status); return send(res, r.status, r.html);
  } catch (e) { console.error(p, e); send(res, 500, `<pre>${String(e.stack).replace(/</g, '&lt;')}</pre>`); }
}
module.exports = handler;
if (require.main === module) http.createServer(handler).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}  (theme: ${THEME})`));
