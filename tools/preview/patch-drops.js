// One-off adaptation of the Signature Meubles preview drops to the ZAYOU catalogue (run once, kept for traceability).
const fs = require('fs'); const path = require('path');
const f = path.join(__dirname, 'drops.js'); let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('not found: ' + a.slice(0, 80)); s = s.replace(a, b); };

rep("const media = p.images.map(im => new Img(im.src, { alt: im.alt, position: im.position, id: hash(im.src) }));",
  "const media = p.images.map(im => new Img(im.src, { alt: im.alt, position: im.position, id: hash(im.src), width: im.width, height: im.height }));\n  const cmp = Math.max(0, ...p.variants.map(v => v.compare_at_price || 0));");
rep("compare_at_price: null, compare_at_price_min: 0, compare_at_price_max: 0, compare_at_price_varies: false,",
  "compare_at_price: cmp > p.price ? cmp : null, compare_at_price_min: cmp, compare_at_price_max: cmp, compare_at_price_varies: false,");
rep("template_suffix: '', metafields: {}, created_at: '2026-10-20T10:00:00Z', published_at: '2026-10-20T10:00:00Z',",
  "template_suffix: '', metafields: { zayou: {} }, created_at: p.created_at, published_at: p.published_at,");
rep("featured_image: null, featured_media: null, quantity_rule", "featured_image: null, featured_media: null, compare_at_price: v.compare_at_price || null, quantity_rule");
rep("price_varies: prod.price_varies, compare_at_price: null,", "price_varies: prod.price_varies, compare_at_price: prod.compare_at_price,");
rep("image: c.image ? new Img(FILES_CDN + c.image, { alt: '' }) : null,", "image: c.image ? new Img(c.image, { alt: '' }) : null,");

const a = s.indexOf('// ---- Storefront filtering'); const b = s.indexOf('// ---- Settings:');
s = s.slice(0, a) + `// ---- Storefront filtering (Search & Discovery) ----
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
    if (pmin && p.price_max < +String(pmin).replace(/\\s/g, '') * 100) return false; if (pmax && p.price > +String(pmax).replace(/\\s/g, '') * 100) return false;
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

` + s.slice(b);
rep("case 'metaobject': case 'metaobject_list': case 'video': case 'blog': case 'article': return null;",
  "case 'article': return v ? (ctx.articles && ctx.articles[v]) || null : null;\n    case 'metaobject': case 'metaobject_list': case 'video': case 'blog': return null;");
rep("case 'page': return v ? { handle: v, title: v, url: '/pages/' + v, content: '' } : null;",
  "case 'page': return v ? (ctx.pages && ctx.pages[v]) || { handle: v, title: v, url: '/pages/' + v, content: '' } : null;");
rep("const UNPUB = h => !!process.env.SM_UNPUBLISHED && h !== 'all';", 'const UNPUB = () => false;');
fs.writeFileSync(f, s); console.log('drops.js patched');
