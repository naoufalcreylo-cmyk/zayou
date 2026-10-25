// Shopify-shaped objects for the local preview, built from data/catalog.json (real export) and theme settings.
// Only what the theme reads is modelled; anything else resolves to nil like a missing Shopify property.
const fs = require('fs'); const path = require('path');
const { Drop } = require('liquidjs');
const ROOT = path.resolve(__dirname, '../..');
const FILES_CDN = 'https://cdn.shopify.com/s/files/1/0770/9242/1718/files/';

class Color extends Drop {
  constructor(hex) { super(); this.hex = hex.toLowerCase(); const n = parseInt(this.hex.slice(1, 7), 16); this.red = n >> 16; this.green = (n >> 8) & 255; this.blue = n & 255; this.alpha = this.hex.length > 7 ? parseInt(this.hex.slice(7, 9), 16) / 255 : 1;
    const r = this.red / 255, g = this.green / 255, b = this.blue / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    this.hue = Math.round(h); this.saturation = Math.round(s * 100); this.lightness = Math.round(l * 100);
    this.rgb = `${this.red} ${this.green} ${this.blue}`; this.rgba = `${this.red} ${this.green} ${this.blue} / ${this.alpha}`; }
  valueOf() { return this.hex; } toString() { return this.hex; } toJSON() { return this.hex; }
}
class Scheme extends Drop {
  constructor(id, settings) { super(); this.id = id; this.settings = Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, v ? new Color(v) : ''])); }
  valueOf() { return this.id; } toString() { return this.id; } toJSON() { return this.id; }
}
class Font extends Drop {
  constructor(handle) { super(); const m = handle.match(/^(.+)_([ni])(\d)$/) || [null, handle, 'n', '4'];
    this.handle = handle; this.family = m[1].split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ').replace('Dm Sans', 'DM Sans');
    this.style = m[2] === 'i' ? 'italic' : 'normal'; this.weight = String(+m[3] * 100); this.fallback_families = 'sans-serif'; this['system?'] = false; this.baseline_ratio = 0.1; }
  modify(prop, v) { const f = new Font(this.handle); if (prop === 'weight') { const cur = +this.weight; f.weight = v === 'bold' ? '700' : v === 'bolder' ? String(Math.min(900, cur + 300)) : v === 'lighter' ? String(Math.max(100, cur - 300)) : String(v); } if (prop === 'style') f.style = v; return f; }
  valueOf() { return this.family; } toString() { return this.family; }
}
class Img extends Drop {
  constructor(src, o = {}) { super(); this.src = src; this.url = src; this.width = o.width || 1254; this.height = o.height || 1254; this.aspect_ratio = this.width / this.height; this.alt = o.alt || ''; this.id = o.id || hash(src); this.position = o.position || 1;
    this.media_type = 'image'; this.preview_image = this; this.presentation = { focal_point: '50.0% 50.0%' }; this.attached_to_variant = false;
    (Img.registry ||= new Map()).set(src, this); }
  valueOf() { return this.src; } toString() { return this.src; } toJSON() { return { id: this.id, src: this.src, width: this.width, height: this.height, alt: this.alt, aspect_ratio: this.aspect_ratio, position: this.position }; }
}
function hash(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));
const productByHandle = {}; const collectionByHandle = {};

function makeProduct(p) {
  const media = p.images.map(im => new Img(im.src, { alt: im.alt, position: im.position, id: hash(im.src), width: im.width, height: im.height }));
  const cmp = Math.max(0, ...p.variants.map(v => v.compare_at_price || 0));
  const prod = {
    id: p.id, handle: p.handle, title: p.title, url: `/products/${p.handle}`, vendor: p.vendor, type: p.product_type, tags: p.tags,
    description: p.body_html, content: p.body_html, available: p.available, price: p.price, price_min: p.price, price_max: p.price_max, price_varies: p.price !== p.price_max,
    compare_at_price: cmp > p.price ? cmp : null, compare_at_price_min: cmp, compare_at_price_max: cmp, compare_at_price_varies: false,
    media, images: media, featured_image: media[0] || null, featured_media: media[0] || null,
    has_only_default_variant: p.options.length === 1 && p.options[0].name === 'Title', requires_selling_plan: false, selling_plan_groups: [], 'gift_card?': false,
    'quantity_price_breaks_configured?': false, template_suffix: '', metafields: { zayou: {} }, created_at: p.created_at, published_at: p.published_at,
    options: p.options.map(o => o.name), dimensions: p.dimensions,
  };
  prod.variants = p.variants.map(v => ({ ...v, options: [v.option1, v.option2, v.option3].filter(Boolean), url: `/products/${p.handle}?variant=${v.id}`, requires_shipping: true, taxable: true, barcode: '', weight: 0,
    featured_image: null, featured_media: null, compare_at_price: v.compare_at_price || null, quantity_rule: { min: 1, max: null, increment: 1 }, quantity_price_breaks: [], store_availabilities: [], selected: false, matched: true, metafields: {}, unit_price_measurement: null,
    get product() { return prod; }, name: `${p.title}${v.title && v.title !== 'Default Title' ? ' - ' + v.title : ''}` }));
  prod.first_available_variant = prod.variants.find(v => v.available) || prod.variants[0];
  prod.selected_variant = null;
  Object.defineProperty(prod, 'selected_or_first_available_variant', { get() { return this.selected_variant || this.first_available_variant; }, enumerable: false });
  Object.defineProperty(prod, 'options_with_values', { enumerable: false, get() {
    const sel = this.selected_or_first_available_variant;
    return p.options.map((o, i) => { const key = 'option' + (i + 1);
      const values = o.values.map(val => { const match = prod.variants.find(v => v[key] === val && p.options.every((oo, j) => j === i || v['option' + (j + 1)] === sel['option' + (j + 1)])) || prod.variants.find(v => v[key] === val);
        return { name: val, value: val, id: hash(o.name + val), available: !!(match && match.available), exists: !!match, selected: sel[key] === val, swatch: null, variant: match, product_url: prod.url, toString() { return val; }, valueOf() { return val; } }; });
      return { name: o.name, position: i + 1, values, selected_value: sel[key], toString() { return o.name; } }; });
  } });
  Object.defineProperty(prod, 'collections', { enumerable: false, get() { return Object.values(collectionByHandle).filter(c => c._handles.includes(prod.handle)); } });
  prod.toJSON = function () { return { id: prod.id, title: prod.title, handle: prod.handle, description: prod.description, vendor: prod.vendor, type: prod.type, tags: prod.tags, price: prod.price, price_min: prod.price_min, price_max: prod.price_max, available: prod.available, price_varies: prod.price_varies, compare_at_price: prod.compare_at_price, variants: prod.variants.map(({ product, ...v }) => v), images: media.map(m => m.src), featured_image: media[0]?.src, options: p.options.map(o => o.name), media: media.map(m => m.toJSON()), url: prod.url }; };
  return prod;
}
for (const p of catalog.products) productByHandle[p.handle] = makeProduct(p);
const sortFns = { manual: () => 0, 'best-selling': () => 0, 'title-ascending': (a, b) => a.title.localeCompare(b.title, 'fr'), 'title-descending': (a, b) => b.title.localeCompare(a.title, 'fr'),
  'price-ascending': (a, b) => a.price - b.price, 'price-descending': (a, b) => b.price - a.price, 'created-ascending': () => 0, 'created-descending': () => 0 };

function makeCollection(c) {
  const col = { id: hash(c.handle), handle: c.handle, title: c.title, url: `/collections/${c.handle}`, description: c.description ? `<p>${c.description}</p>` : '', image: c.image ? new Img(c.image, { alt: '' }) : null, featured_image: null, template_suffix: '', metafields: {},
    _handles: c.product_handles, default_sort_by: 'manual', sort_by: '', filters: [], current_type: null, current_vendor: null,
    sort_options: Object.keys(sortFns).map(v => ({ value: v, name: { manual: 'En vedette', 'best-selling': 'Meilleures ventes', 'title-ascending': 'Alphabétique, de A à Z', 'title-descending': 'Alphabétique, de Z à A', 'price-ascending': 'Prix : faible à élevé', 'price-descending': 'Prix : élevé à faible', 'created-ascending': 'Date : ancienne à récente', 'created-descending': 'Date : récente à ancienne' }[v] })) };
  Object.defineProperty(col, 'all_products', { enumerable: false, get() { return this._handles.map(h => productByHandle[h]); } });
  Object.defineProperty(col, '_filtered', { enumerable: false, get() { return applyFilters(this.all_products, this._query || {}).sort(sortFns[this.sort_by || 'manual'] || (() => 0)); } });
  Object.defineProperty(col, 'products', { enumerable: false, get() { const all = this._filtered; return this._paginate ? all.slice(this._paginate.offset, this._paginate.offset + this._paginate.by) : all; } });
  Object.defineProperty(col, 'products_count', { enumerable: false, get() { return this._filtered.length; } });
  Object.defineProperty(col, 'all_products_count', { enumerable: false, get() { return this._handles.length; } });
  // Shopify collection drops stringify to their handle (themes use collections[some_collection])
  Object.defineProperty(col, 'toString', { enumerable: false, value: () => c.handle });
  const first = () => col.image || col.all_products[0]?.featured_image || null;
  Object.defineProperty(col, 'featured_image', { enumerable: false, get: first });
  return col;
}
for (const c of catalog.collections) collectionByHandle[c.handle] = makeCollection(c);
collectionByHandle.all = makeCollection({ handle: 'all', title: 'Tous les produits', product_handles: catalog.products.map(p => p.handle) });

// ---- Storefront filtering (Search & Discovery) ----
// ZY_LIVE_FILTERS=1 → what zayou-5.myshopify.com has today (availability + price only).
// Default → recommended setup: size option filter ("Taille", param filter.v.option.taille, all size option names grouped), product type, vendor.
const LIVE = !!process.env.ZY_LIVE_FILTERS;
const sizeOf = (p, v) => { const i = p.options.findIndex(n => /taille|pointure/i.test(n)); return i < 0 ? null : v['option' + (i + 1)]; };
const multi = (q, k) => [].concat(q[k] || []);
function applyFilters(list, q) {
  const sizes = multi(q, 'filter.v.option.taille'); const av = multi(q, 'filter.v.availability');
  const inStock = av.includes('1') && !av.includes('0'); const outStock = av.includes('0') && !av.includes('1');
  return list.filter(p => {
    if (!LIVE && sizes.length) { if (!p.variants.some(v => sizes.includes(sizeOf(p, v)) && (!inStock || v.available))) return false; }
    else if (inStock && !p.available) return false;
    if (outStock && p.available) return false;
    const types = multi(q, 'filter.p.product_type'); if (types.length && !types.includes(p.type)) return false;
    const vendors = multi(q, 'filter.p.vendor'); if (vendors.length && !vendors.includes(p.vendor)) return false;
    const pmin = q['filter.v.price.gte'], pmax = q['filter.v.price.lte'];
    if (pmin && p.price_max < +String(pmin).replace(/\s/g, '') * 100) return false; if (pmax && p.price > +String(pmax).replace(/\s/g, '') * 100) return false;
    return true;
  });
}
function buildFilters(col, q, baseUrl) {
  const all = col.all_products; const extra = q.q ? [['q', [].concat(q.q)[0]]] : [];
  const pairs = o => Object.entries(o).flatMap(([k, v]) => [].concat(v).map(x => [k, x]));
  const mk = (param, label, type, values) => {
    const vals = values.map(([value, lbl, count]) => { const active = multi(q, param).includes(value);
      const others = pairs(q).filter(([k, x]) => !(k === param && x === value) && k !== 'page' && k !== 'q');
      const withThis = active ? others : [...others, [param, value]];
      return { value, label: lbl, count, active, param_name: param, url_to_add: baseUrl + '?' + new URLSearchParams([...extra, ...withThis]), url_to_remove: baseUrl + '?' + new URLSearchParams([...extra, ...others]), swatch: null, image: null }; });
    return { label, param_name: param, type, values: vals, active_values: vals.filter(v => v.active), inactive_values: vals.filter(v => !v.active), presentation: 'text', operator: 'OR',
      url_to_remove: baseUrl + '?' + new URLSearchParams([...extra, ...pairs(q).filter(([k]) => k !== param && k !== 'page' && k !== 'q')]) };
  };
  const without = param => { const o = { ...q }; delete o[param]; return applyFilters(all, o); }; // Shopify counts ignore the filter's own values
  const out = [];
  const av = without('filter.v.availability');
  out.push(mk('filter.v.availability', 'Disponibilité', 'list', [['1', 'En stock', av.filter(p => p.available).length], ['0', 'En rupture de stock', av.filter(p => !p.available).length]]));
  if (!LIVE) {
    const base = without('filter.v.option.taille'); const sz = {};
    base.forEach(p => p.variants.forEach(v => { const x = sizeOf(p, v); if (x) (sz[x] ||= new Set()).add(p.handle); }));
    const sizes = Object.keys(sz).sort((x, y) => +x - +y);
    if (sizes.length > 1) out.unshift(mk('filter.v.option.taille', 'Taille', 'list', sizes.map(x => [x, x, sz[x].size])));
    const tb = without('filter.p.product_type'); const types = [...new Set(all.map(p => p.type).filter(Boolean))];
    if (types.length > 1) out.push(mk('filter.p.product_type', 'Type de produit', 'list', types.map(t => [t, t, tb.filter(p => p.type === t).length])));
    const vb = without('filter.p.vendor'); const vendors = [...new Set(all.map(p => p.vendor))];
    if (vendors.length > 1) out.push(mk('filter.p.vendor', 'Marque', 'list', vendors.map(t => [t, t, vb.filter(p => p.vendor === t).length])));
  }
  const maxP = Math.max(0, ...all.map(p => p.price_max)) / 100;
  const qs = pairs(q).filter(([k]) => !k.startsWith('filter.v.price') && k !== 'page' && k !== 'q');
  out.push({ label: 'Prix', param_name: 'filter.v.price', type: 'price_range', range_max: maxP * 100, min_value: { param_name: 'filter.v.price.gte', value: q['filter.v.price.gte'] ? +[].concat(q['filter.v.price.gte'])[0] * 100 : null }, max_value: { param_name: 'filter.v.price.lte', value: q['filter.v.price.lte'] ? +[].concat(q['filter.v.price.lte'])[0] * 100 : null }, active_values: [], values: [], url_to_remove: baseUrl + '?' + new URLSearchParams([...extra, ...qs]) });
  return out;
}

// ---- Settings: schema defaults + settings_data current, resolved to drops ----------------------
function resolve(type, v, ctx) {
  if (v === undefined || v === null) v = '';
  switch (type) {
    case 'color': return v ? new Color(v) : '';
    case 'color_background': return v || '';
    case 'color_scheme': return ctx.schemes[v] || ctx.schemes['scheme-1'];
    case 'font_picker': return new Font(v || 'assistant_n4');
    case 'image_picker': return v ? imageFromSetting(v) : null;
    // SM_UNPUBLISHED=1 mimics the store today: collections exist (menus see them) but are not on the Online Store
    case 'collection': return v && !UNPUB(v) ? collectionByHandle[v] || null : null;
    case 'product': return v ? productByHandle[v] || null : null;
    case 'collection_list': return (v || []).filter(h => !UNPUB(h)).map(h => collectionByHandle[h]).filter(Boolean);
    case 'product_list': return (v || []).map(h => productByHandle[h]).filter(Boolean);
    case 'link_list': return v ? ctx.linklists[v] || null : null;
    case 'checkbox': return v === true || v === 'true';
    case 'range': case 'number': return v === '' ? null : +v;
    case 'url': return v === '' ? null : String(v).replace(/^shopify:\/\/collections\//, '/collections/').replace(/^shopify:\/\/products\//, '/products/').replace(/^shopify:\/\/pages\//, '/pages/');
    case 'page': return v ? (ctx.pages && ctx.pages[v]) || { handle: v, title: v, url: '/pages/' + v, content: '' } : null;
    case 'video_url': return v ? { type: 'youtube', id: v } : null;
    case 'article': return v ? (ctx.articles && ctx.articles[v]) || null : null;
    case 'metaobject': case 'metaobject_list': case 'video': case 'blog': return null;
    default: return v;
  }
}
function imageFromSetting(v) {
  const name = String(v).replace('shopify://shop_images/', '');
  const local = path.join(ROOT, 'tools/preview/shop_images', name);
  if (fs.existsSync(local)) return new Img('/shop_images/' + name, { width: 1254, height: 1254 });
  return new Img(FILES_CDN + name, { width: 1254, height: 1254 });
}
const UNPUB = () => false;
function resolveSettings(schemaSettings, values, ctx) {
  const out = {};
  for (const s of schemaSettings || []) { if (!s.id) continue; out[s.id] = resolve(s.type, values && s.id in values ? values[s.id] : s.default, ctx); }
  return out;
}

module.exports = { UNPUB, Color, Scheme, Font, Img, hash, catalog, productByHandle, collectionByHandle, applyFilters, buildFilters, resolve, resolveSettings, ROOT, FILES_CDN };
