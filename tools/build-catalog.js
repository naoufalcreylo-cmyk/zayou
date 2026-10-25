// Builds data/catalog.json (local preview) and data/colorways.json from the live storefront exports in research/
// (products.json + per-collection products.json fetched from zayou-5.myshopify.com on 2026-10-25).
// Colours are separate products on this store (variants = sizes only), so colourway groups are derived from titles.
// node tools/build-catalog.js
const fs = require('fs'); const path = require('path');
const R = path.join(__dirname, '../research'); const OUT = path.join(__dirname, '../data');
fs.mkdirSync(OUT, { recursive: true });
const products = JSON.parse(fs.readFileSync(path.join(R, 'products.json'), 'utf8')).products;
const collectionsMeta = JSON.parse(fs.readFileSync(path.join(R, 'collections.json'), 'utf8')).collections;
const cents = s => (s == null || s === '' ? null : Math.round(parseFloat(s) * 100));

// ---- colourways ------------------------------------------------------------------------------
// Colour vocabulary seen in titles → swatch hex (approximation of the photographed leather/suede, for swatches only)
const COLORS = [
  ['marron gris fonce', 'Marron / gris foncé', '#5a5148'], ['blanc casse', 'Blanc cassé', '#ebe5d6'], ['bleu marine', 'Bleu marine', '#1f2c44'], ['gris fonce', 'Gris foncé', '#4b4b4a'], ['gris claire', 'Gris clair', '#b9b8b3'], ['gris b', 'Gris', '#8e8d89'],
  ['tabac claire', 'Tabac clair', '#b27d4c'], ['marron claire', 'Marron clair', '#8d6242'],
  ['noir', 'Noir', '#161616'], ['blanche', 'Blanc', '#f3f2ee'], ['blanc', 'Blanc', '#f3f2ee'], ['tabac', 'Tabac', '#8a5a32'], ['marron', 'Marron', '#5b3a26'], ['gris', 'Gris', '#8e8d89'],
  ['beige', 'Beige', '#cdb995'], ['bleu', 'Bleu', '#30496b'], ['vert', 'Vert', '#5f6b45'], ['kaki', 'Kaki', '#6f6a4b'],
];
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function colorsIn(text) {
  let t = ' ' + norm(text).replace(/[-/]/g, ' ').replace(/\s+/g, ' ') + ' '; const found = [];
  for (const [k, label, hex] of COLORS) { const i = t.indexOf(' ' + k + ' '); if (i >= 0) { found.push({ i, label, hex }); t = t.slice(0, i) + ' ' + '#'.repeat(k.length) + ' ' + t.slice(i + k.length + 2); } }
  return found.sort((a, b) => a.i - b.i).map(({ label, hex }) => ({ label, hex }));
}
function material(text) { const t = norm(text); if (/cuir \/ daim|cuir daim/.test(t)) return 'Cuir et daim'; if (/nubuck/.test(t)) return 'Nubuck'; if (/daim/.test(t)) return 'Daim'; if (/cuir/.test(t)) return 'Cuir'; return null; }
// model key + colourway label from the title
function parse(p) {
  const t = p.title.trim(); let m;
  if ((m = t.match(/^(Basket|Bottine) Homme (\d+)( Simple)?\s*-\s*(.+)$/i))) return { model: `${m[1]} Homme ${m[2]}${m[3] || ''}`, way: m[4] };
  if ((m = t.match(/^Basket Homme (\d+)-\s*(.+)$/i))) return { model: `Basket Homme ${m[1]}`, way: m[2] };
  if ((m = t.match(/^(\d{3}) Sandales Homme en\s*-?\s*(.+)$/i))) return { model: `Sandales ${m[1]}`, way: m[2] };
  if ((m = t.match(/^(\d{3})?\s*MOCASSINS? SOUPLES? EN (CUIR|DAIM)\s*(.*)$/i))) return { model: `Mocassins souples${m[1] ? ' ' + m[1] : ''}`, way: `${m[2]} ${m[3]}`.trim() };
  if ((m = t.match(/^Sabot pantoufle (.+?) - (\d+)$/i))) return { model: `Sabot pantoufle ${m[2]}`, way: m[1] };
  if ((m = t.match(/^([A-Z][\w@]+(?: simple)?) - (.+)$/))) return { model: m[1], way: m[2] };
  return { model: t, way: '' };
}

const items = products.map(p => { const { model, way } = parse(p); const cols = colorsIn(way || p.title); return { handle: p.handle, title: p.title, model, way, colors: cols, material: material(way || p.title), category: p.product_type }; });
const groups = {}; for (const it of items) (groups[it.model] ||= []).push(it);
const colorways = {};
for (const it of items) {
  const sib = groups[it.model];
  colorways[it.handle] = { model: it.model, label: it.colors.length ? it.colors.map(c => c.label).join(' / ') : null, material: it.material, hex: it.colors.map(c => c.hex), siblings: sib.length > 1 ? sib.map(s => s.handle) : [] };
}
fs.writeFileSync(path.join(OUT, 'colorways.json'), JSON.stringify(colorways, null, 1));

// ---- catalog for the preview ----------------------------------------------------------------
const membership = {};
for (const f of fs.readdirSync(R).filter(f => /^c-.*-1\.json$/.test(f))) {
  const h = f.replace(/^c-/, '').replace(/-1\.json$/, '');
  membership[h] = JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')).products.map(p => p.handle);
}
const catalog = {
  source: 'zayou-5.myshopify.com /products.json + /collections/<handle>/products.json, 2026-10-25',
  products: products.map(p => {
    const variants = p.variants.map(v => ({ id: v.id, title: v.title, sku: v.sku || '', price: cents(v.price), compare_at_price: cents(v.compare_at_price), available: v.available, option1: v.option1, option2: v.option2, option3: v.option3, featured_image_src: v.featured_image ? v.featured_image.src : null }));
    const prices = variants.map(v => v.price);
    return { id: p.id, handle: p.handle, title: p.title, body_html: p.body_html, vendor: p.vendor, product_type: p.product_type, tags: p.tags, created_at: p.created_at, published_at: p.published_at,
      options: p.options.map(o => ({ name: o.name, position: o.position, values: o.values })), variants,
      images: p.images.map(im => ({ src: im.src, width: im.width, height: im.height, alt: im.alt || '', position: im.position, variant_ids: im.variant_ids })),
      price: Math.min(...prices), price_max: Math.max(...prices), available: variants.some(v => v.available) };
  }),
  collections: collectionsMeta.map(c => ({ handle: c.handle, title: c.title, description: (c.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), image: c.image ? c.image.src : null, product_handles: membership[c.handle] || [] })),
};
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1));

const multi = Object.values(groups).filter(g => g.length > 1);
console.log(`products ${products.length} · collections ${catalog.collections.length} · models ${Object.keys(groups).length} (${multi.length} with ≥2 colourways)`);
const noColor = items.filter(i => !i.colors.length && i.category); if (noColor.length) console.log('no colour parsed:', noColor.map(i => i.title).join(' | '));
