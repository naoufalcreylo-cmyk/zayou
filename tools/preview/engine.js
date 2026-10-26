// LiquidJS configured to behave like Shopify for this theme: custom tags, Shopify filters, translations.
const fs = require('fs'); const path = require('path');
const { Liquid, Tag, Value, Drop } = require('liquidjs');
const { Color, Img, Font, ROOT } = require('./drops');

const THEME = path.join(ROOT, process.env.THEME_DIR || 'theme');
const engine = new Liquid({ root: [path.join(THEME, 'snippets')], extname: '.liquid', cache: false, jsTruthy: false, lenientIf: true, ownPropertyOnly: false, dynamicPartials: true, outputEscape: undefined });
const missing = new Set();

// ---- translations ------------------------------------------------------------------------------
const loadJSON = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/^\s*\/\*[\s\S]*?\*\//, ''));
let LOCALE, FALLBACK;
function loadLocales() { LOCALE = loadJSON(path.join(THEME, 'locales/fr.default.json')); FALLBACK = {}; }
loadLocales();
const dig = (o, key) => key.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function translate(key, vars = {}) {
  let v = dig(LOCALE, key);
  if (v === undefined) { v = dig(FALLBACK, key); missing.add((v === undefined ? 'MISSING ' : 'EN ') + key); }
  if (v === undefined) return `translation missing: fr.${key}`;
  if (typeof v === 'object') { const c = vars.count; v = (c === 0 && v.zero) || (c === 1 && v.one) || v.other || v.one || ''; }
  return String(v).replace(/{{\s*(\w+)\s*}}/g, (_, k) => (vars[k] ?? ''));
}

// ---- helpers -----------------------------------------------------------------------------------
const kw = args => { const o = {}; const pos = []; for (const a of args) Array.isArray(a) && a.length === 2 && typeof a[0] === 'string' ? (o[a[0]] = a[1]) : pos.push(a); return { o, pos }; };
const val = v => (v instanceof Drop ? v.valueOf() : v);
const escAttr = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function fmtMoney(cents, format) {
  cents = Math.round(+cents || 0);
  const grp = (n, sep, dec, d) => { const [i, f] = (n / 100).toFixed(d).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (d ? dec + f : ''); };
  return format.replace(/{{\s*(\w+)\s*}}/, (_, t) => ({ amount: grp(cents, ',', '.', 2), amount_no_decimals: grp(cents, ',', '.', 0), amount_with_comma_separator: grp(cents, '.', ',', 2), amount_no_decimals_with_comma_separator: grp(cents, '.', ',', 0), amount_with_space_separator: grp(cents, ' ', ',', 2), amount_no_decimals_with_space_separator: grp(cents, ' ', ',', 0), amount_with_apostrophe_separator: grp(cents, "'", '.', 2) }[t] ?? grp(cents, ',', '.', 2)));
}
const hexOf = c => { c = val(c); if (!c) return null; c = String(c).trim(); if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + [...c.slice(1)].map(x => x + x).join(''); if (/^#[0-9a-f]{6,8}$/i.test(c)) return new Color(c.slice(0, 7)); const m = c.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/); if (m) return new Color('#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('')); return null; };
const toHex = (r, g, b) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
function hsl2hex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return toHex(f(0) * 255, f(8) * 255, f(4) * 255); }
function imgParams(src) { const u = String(src); const base = u.replace(/[?&](width|height|crop)=[^&]*/g, ''); return base; }
function imageUrl(input, o = {}) {
  if (!input) return '';
  let src = typeof input === 'string' ? input : input.src || input.url || String(val(input));
  if (src.startsWith('//')) src = 'https:' + src;
  if (!/cdn\.shopify\.com/.test(src)) return src;
  const sep = src.includes('?') ? '&' : '?'; const p = [];
  if (o.width) p.push('width=' + o.width); if (o.height) p.push('height=' + o.height); if (o.crop) p.push('crop=' + o.crop);
  return p.length ? src + sep + p.join('&') : src;
}

// Shopify tag filters return HTML-safe strings; `escape` leaves them untouched (Hyper relies on this)
class Safe extends String {}
const safe = s => new Safe(s);
// ---- filters -----------------------------------------------------------------------------------
const F = {
  t(key, ...args) { const { o } = kw(args); const s = translate(String(key), o); return s; },
  asset_url: n => `/assets/${n}`, shopify_asset_url: n => `/shopify-assets/${n}`, file_url: n => `/files/${n}`, asset_img_url: n => `/assets/${n}`,
  inline_asset_content(n) { try { return fs.readFileSync(path.join(THEME, 'assets', n), 'utf8'); } catch { return ''; } },
  stylesheet_tag(u, ...a) { const { o } = kw(a); return `<link href="${u}" rel="stylesheet" type="text/css" media="all"${o.preload ? '' : ''}>`; },
  script_tag: u => `<script src="${u}" type="text/javascript"></script>`,
  preload_tag: (u, ...a) => `<link rel="preload" href="${u}" as="${kw(a).o.as || 'style'}">`,
  image_url(input, ...a) { return imageUrl(input, kw(a).o); },
  img_url(input, size) { const m = String(size || '').match(/^(\d+)?x?(\d+)?$/) || []; return imageUrl(input, { width: m[1], height: m[2] }); },
  image_tag(url, ...a) {
    const { o } = kw(a); url = String(val(url)); const info = Img.registry?.get(imgParams(url)) || { width: 1254, height: 1254 };
    const w0 = +(url.match(/[?&]width=(\d+)/) || [])[1] || info.width; const h0 = +(url.match(/[?&]height=(\d+)/) || [])[1] || Math.round(w0 * info.height / info.width);
    const widths = (o.widths ? String(o.widths).split(',').map(x => +x.trim()) : [352, 832, 1200, 1920].filter(x => x < w0).concat([w0])).filter(x => x <= Math.max(info.width, w0));
    const base = imgParams(url); const srcset = widths.map(w => `${imageUrl(base, { width: w })} ${w}w`).join(', ');
    const attrs = { src: url, alt: o.alt ?? info.alt ?? '', srcset, width: o.width || w0, height: o.height || h0 };
    for (const [k, v] of Object.entries(o)) if (!['widths', 'alt', 'width', 'height', 'preload'].includes(k) && v !== null && v !== undefined && v !== false && v !== '') attrs[k] = v;
    if (attrs.loading === undefined && !o.preload && o.fetchpriority !== 'high') {}
    return safe('<img ' + Object.entries(attrs).map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ') + '>');
  },
  placeholder_svg_tag(name, cls) { return `<svg class="${escAttr(cls || '')}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 525" preserveAspectRatio="xMidYMid slice"><rect width="525" height="525" fill="#e9e1d6"/><path d="M180 330h165M210 300v30M315 300v30M195 300h135v-50H195z" stroke="#b9ad9c" stroke-width="3" fill="none"/></svg>`; },
  money(c) { return fmtMoney(c, this.context.globals.shop.money_format); },
  money_with_currency(c) { return fmtMoney(c, this.context.globals.shop.money_with_currency_format); },
  money_without_currency(c) { return fmtMoney(c, '{{amount}}'); },
  money_without_trailing_zeros(c) { return fmtMoney(c, this.context.globals.shop.money_format).replace(/[.,]00(?=\D*$)/, ''); },
  json(v) { return JSON.stringify((v && typeof v.toJSON === 'function' ? v.toJSON() : val(v)) ?? null, (k, x) => (x instanceof Drop && typeof x.toJSON !== 'function' ? x.valueOf() : x)).replace(/<\//g, '<\\/'); },
  handle: s => String(val(s) ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  handleize(s) { return F.handle(s); },
  font_face(font) { return ''; }, font_url() { return ''; },
  font_modify(font, prop, v) { return font instanceof Font ? font.modify(prop, v) : font; },
  color_to_rgb(c) { const x = hexOf(c); return x ? `rgb(${x.red}, ${x.green}, ${x.blue})` : ''; },
  color_to_hex(c) { const x = hexOf(c); return x ? x.hex : ''; },
  color_extract(c, comp) { const x = hexOf(c); return x ? x[comp] : ''; },
  color_brightness(c) { const x = hexOf(c); return x ? (x.red * 299 + x.green * 587 + x.blue * 114) / 1000 : 0; },
  color_modify(c, prop, v) { const x = hexOf(c); if (!x) return ''; if (prop === 'alpha') return `rgba(${x.red}, ${x.green}, ${x.blue}, ${v})`; const o = { red: x.red, green: x.green, blue: x.blue }; if (prop in o) { o[prop] = +v; return toHex(o.red, o.green, o.blue); } const h = { hue: x.hue, saturation: x.saturation, lightness: x.lightness }; h[prop] = +v; return hsl2hex(h.hue, h.saturation, h.lightness); },
  color_lighten(c, p) { const x = hexOf(c); return x ? hsl2hex(x.hue, x.saturation, Math.min(100, x.lightness + +p)) : ''; },
  color_darken(c, p) { const x = hexOf(c); return x ? hsl2hex(x.hue, x.saturation, Math.max(0, x.lightness - +p)) : ''; },
  color_saturate(c, p) { const x = hexOf(c); return x ? hsl2hex(x.hue, Math.min(100, x.saturation + +p), x.lightness) : ''; },
  color_desaturate(c, p) { const x = hexOf(c); return x ? hsl2hex(x.hue, Math.max(0, x.saturation - +p), x.lightness) : ''; },
  color_mix(a, b, w) { const x = hexOf(a), y = hexOf(b); if (!x || !y) return ''; const t = (+w) / 100; return toHex(x.red * t + y.red * (1 - t), x.green * t + y.green * (1 - t), x.blue * t + y.blue * (1 - t)); },
  color_contrast(a, b) { const L = c => { const x = hexOf(c); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(x.red) + 0.7152 * f(x.green) + 0.0722 * f(x.blue); }; const [l1, l2] = [L(a), L(b)].sort((p, q) => q - p); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(1); },
  url_for_type: t => `/collections/types?q=${encodeURIComponent(t)}`, url_for_vendor: v => `/collections/vendors?q=${encodeURIComponent(v)}`,
  within: u => u, link_to: (t, u) => `<a href="${escAttr(u)}">${t}</a>`, url_param_escape: s => encodeURIComponent(s ?? ''), url_escape: s => encodeURI(s ?? ''),
  time_tag(d, fmt) { const dt = new Date(val(d)); return `<time datetime="${dt.toISOString()}">${dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</time>`; },
  item_count_for_variant(cart, id) { return (cart.items || []).filter(i => i.variant_id === +id).reduce((a, i) => a + i.quantity, 0); },
  line_items_for(cart, obj) { const id = obj?.id; return (cart.items || []).filter(i => i.variant_id === id || i.product_id === id); },
  structured_data(obj) { const p = obj; if (!p || !p.variants) return '{}'; const shop = this.context.globals.shop;
    return JSON.stringify({ '@context': 'http://schema.org/', '@type': 'ProductGroup', name: p.title, url: shop.url + p.url, description: String(p.description).replace(/<[^>]+>/g, ' ').trim(), brand: { '@type': 'Brand', name: p.vendor }, productGroupID: String(p.id), image: p.media.map(m => m.src),
      variesBy: p.has_only_default_variant ? undefined : ['https://schema.org/size'], hasVariant: p.variants.map(v => ({ '@type': 'Product', sku: v.sku, name: v.name, offers: { '@type': 'Offer', price: (v.price / 100).toFixed(2), priceCurrency: 'MAD', availability: v.available ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock', url: shop.url + v.url } })) }); },
  default_errors: e => (e && e.messages ? `<ul>${Object.values(e.messages).map(m => `<li>${m}</li>`).join('')}</ul>` : ''),
  format_address: a => (a ? [a.address1, a.city, a.country].filter(Boolean).join('<br>') : ''), payment_type_svg_tag: () => '', payment_button: () => '', login_button: () => '', payment_terms: () => '', video_tag: () => '', media_tag: () => '', external_video_tag: () => '', external_video_url: () => '', model_viewer_tag: () => '',
  highlight: (s, q) => s, format_code: s => s, camelize: s => String(s).replace(/[-_ ](\w)/g, (_, c) => c.toUpperCase()), md5: s => String(require('crypto').createHash('md5').update(String(s)).digest('hex')),
  weight_with_unit: g => `${(+g || 0) / 1000} kg`, metafield_tag: () => '', metafield_text: () => '', customer_login_link: t => `<a href="/account/login">${t}</a>`,
};
for (const [n, fn] of Object.entries(F)) engine.registerFilter(n, fn);
engine.registerFilter('default', function (v, d, ...rest) { const { o } = kw(rest); const x = val(v); if (o.allow_false && x === false) return x; return x === undefined || x === null || x === '' || x === false || (Array.isArray(x) && !x.length) ? d : v; });
const esc0 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
engine.registerFilter('escape', v => (v instanceof Safe ? v : v == null ? '' : esc0(val(v))));
engine.registerFilter('size', v => { v = val(v); return v == null ? 0 : (v.length ?? (typeof v === 'object' ? Object.keys(v).length : 0)); });

// ---- tags --------------------------------------------------------------------------------------
const rawTag = name => class extends Tag { constructor(t, rem) { super(t, rem); let n = 0; while (rem.length) { const x = rem.shift(); if (x.name === 'end' + name) return; } } *render() {} };
['schema', 'javascript', 'stylesheet', 'doc', 'comment'].forEach(n => engine.registerTag(n, rawTag(n)));
const blockTag = (name, wrap) => class extends Tag {
  constructor(t, rem, liquid, parser) { super(t, rem, liquid); this.args = t.args; this.tpls = []; const s = parser.parseStream(rem).on('tag:end' + name, () => s.stop()).on('template', x => this.tpls.push(x)).on('end', () => { throw new Error(name + ' not closed'); }); s.start(); }
  *render(ctx, em) { const inner = []; const sub = { write: h => inner.push(h) }; const r = yield* wrap.call(this, ctx, () => this.liquid.renderer.renderTemplates(this.tpls, ctx, em), em); if (r !== undefined) em.write(r); }
};
engine.registerTag('style', blockTag('style', function* (ctx, body, em) { em.write('<style data-shopify>'); yield body(); em.write('</style>'); }));

// {% form 'type', obj, key: value, ... %}
function splitArgs(s) { const out = []; let d = 0, q = null, cur = ''; for (const c of s) { if (q) { cur += c; if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '(' || c === '[') d++; if (c === ')' || c === ']') d--; if (c === ',' && !d) { out.push(cur.trim()); cur = ''; continue; } cur += c; } if (cur.trim()) out.push(cur.trim()); return out; }
const FORM_ACTION = { product: '/cart/add', localization: '/localization', contact: '/contact#contact_form', customer: '/contact#contact_form', cart: '/cart', customer_login: '/account/login', create_customer: '/account', recover_customer_password: '/account/recover', reset_customer_password: '/account/reset', activate_customer_password: '/account/activate', customer_address: '/account/addresses', new_comment: '/blogs/comments', storefront_password: '/password', currency: '/cart/update' };
engine.registerTag('form', blockTag('form', function* (ctx, body, em) {
  const parts = splitArgs(this.args); const type = String(yield new Value(parts.shift(), this.liquid).value(ctx));
  const attrs = {}; let obj = null;
  for (const p of parts) { const m = p.match(/^([\w-]+)\s*:\s*([\s\S]+)$/); if (m) attrs[m[1]] = val(yield new Value(m[2], this.liquid).value(ctx)); else obj = yield new Value(p, this.liquid).value(ctx); }
  const a = { method: 'post', action: FORM_ACTION[type] || '/', 'accept-charset': 'UTF-8', ...(type === 'product' ? { enctype: 'multipart/form-data' } : {}), ...attrs };
  if (attrs.return_to) delete a.return_to;
  em.write(`<form ${Object.entries(a).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}="${escAttr(v)}"`).join(' ')}><input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`);
  const q = ctx.globals._query || {}; const posted = (type === 'customer' && q.customer_posted === 'true') || (type === 'contact' && q.contact_posted === 'true');
  ctx.push({ form: { errors: null, 'posted_successfully?': posted, email: '', body: '', name: '', id: attrs.id } });
  yield body(); ctx.pop(); em.write('</form>');
}));
// {% paginate collection.products by 24 %}
engine.registerTag('paginate', blockTag('paginate', function* (ctx, body, em) {
  const m = this.args.match(/^\s*([\w.\[\]'"-]+)\s+by\s+([\s\S]+?)\s*$/); const exprPath = m[1]; const by = +val(yield new Value(m[2], this.liquid).value(ctx)) || 12;
  const page = +ctx.globals.current_page || 1; const base = ctx.globals.request.path; const q = ctx.globals._query || {};
  const urlFor = n => base + "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([k]) => k !== "page")), page: n });
  let owner = null, total = 0, scopeOverride = null;
  if (exprPath.includes(".")) { const prop = exprPath.match(/\.(\w+)$/)[1]; owner = yield new Value(exprPath.replace(/\.(\w+)$/, ""), this.liquid).value(ctx);
    total = owner ? (owner[prop + "_count"] ?? owner.products_count ?? owner.results_count ?? (owner[prop] || []).length) : 0; if (owner) owner._paginate = { offset: (page - 1) * by, by }; }
  else { const arr = [].concat(val(yield new Value(exprPath, this.liquid).value(ctx)) || []); total = arr.length; scopeOverride = { [exprPath]: arr.slice((page - 1) * by, page * by) }; }
  const pages = Math.max(1, Math.ceil(total / by));
  const parts = []; for (let i = 1; i <= pages; i++) parts.push({ title: String(i), url: urlFor(i), is_link: i !== page });
  ctx.push({ ...(scopeOverride || {}), paginate: { current_page: page, current_offset: (page - 1) * by, items: total, pages, page_size: by, page_param: "page", parts,
    previous: page > 1 ? { title: "« Précédent", url: urlFor(page - 1), is_link: true } : null, next: page < pages ? { title: "Suivant »", url: urlFor(page + 1), is_link: true } : null } });
  yield body(); ctx.pop(); if (owner) delete owner._paginate;
}));
// {% layout none %} — handled by the server (flag only)
engine.registerTag('layout', class extends Tag { constructor(t, r) { super(t, r); this.v = t.args; } *render(ctx) { ctx.globals._layout = this.v.replace(/['"]/g, '').trim(); } });
// {% sections 'header-group' %} / {% section 'name' %} — delegate to server hooks put in globals
engine.registerTag('sections', class extends Tag { constructor(t, r) { super(t, r); this.v = t.args.replace(/['"]/g, '').trim(); } *render(ctx, em) { em.write(yield ctx.globals._renderGroup(this.v)); } });
engine.registerTag('section', class extends Tag { constructor(t, r) { super(t, r); this.v = t.args.replace(/['"]/g, '').trim(); } *render(ctx, em) { em.write(yield ctx.globals._renderStatic(this.v)); } });
engine.registerTag('content_for', class extends Tag { constructor(t, r) { super(t, r); } *render() {} });

module.exports = { engine, translate, missing, loadLocales, fmtMoney, THEME, loadJSON, imageUrl };
