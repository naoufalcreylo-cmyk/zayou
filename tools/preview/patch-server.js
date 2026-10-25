// One-off adaptation of the preview server/engine to the ZAYOU store (run once, kept for traceability).
const fs = require('fs'); const path = require('path');
function patch(file, pairs) {
  const f = path.join(__dirname, file); let s = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(`${file}: not found: ${a.slice(0, 90)}`); s = s.replace(a, b); }
  fs.writeFileSync(f, s); console.log(file, 'patched');
}

patch('engine.js', [
  ["function loadLocales() { LOCALE = loadJSON(path.join(THEME, 'locales/fr.json')); FALLBACK = loadJSON(path.join(THEME, 'locales/en.default.json')); }",
    "function loadLocales() { LOCALE = loadJSON(path.join(THEME, 'locales/fr.default.json')); FALLBACK = {}; }"],
  // Shopify: money_without_trailing_zeros drops ".00" from the store format
  ["money_without_trailing_zeros(c) { return fmtMoney(c, this.context.globals.shop.money_format); },",
    "money_without_trailing_zeros(c) { return fmtMoney(c, this.context.globals.shop.money_format).replace(/[.,]00(?=\\D*$)/, ''); },"],
  ["money_without_currency(c) { return fmtMoney(c, '{{amount_no_decimals_with_space_separator}}'); },",
    "money_without_currency(c) { return fmtMoney(c, '{{amount}}'); },"],
]);

patch('server.js', [
  ["const { NAV } = require('../collections');\n", ''],
  ["const MONEY = '{{amount_no_decimals_with_space_separator}} DH';", "const MONEY = '{{amount}} dh'; // zayou-5 money format (ES_MONEY_FORMAT on the live store)"],
  ["const shop = { name: 'Signature Meubles',", "const shop = { name: 'Zayou.ma',"],
  ["permanent_domain: 'signature-meubles.myshopify.com',", "permanent_domain: 'zayou-5.myshopify.com',"],
  ["brand: { logo: null, short_description: '', slogan: 'Tout commence à la maison' },", "brand: { logo: null, short_description: '', slogan: '' },"],
  ["privacy_policy: null, refund_policy: null, shipping_policy: null, terms_of_service: null, contact_information: null, types: [...new Set(D.catalog.products.map(p => p.product_type))], vendors: ['Signature Meubles'] };",
    "privacy_policy: { title: 'Politique de confidentialité', url: '/policies/privacy-policy' }, refund_policy: null, shipping_policy: null, terms_of_service: null, contact_information: null, types: [...new Set(D.catalog.products.map(p => p.product_type))], vendors: [...new Set(D.catalog.products.map(p => p.vendor))],\n  policies: [{ title: 'Politique de confidentialité', url: '/policies/privacy-policy', handle: 'privacy-policy' }], checkout: { guest_login: false }, password_message: '' };"],
]);

// replace the whole buildLinklists/pages block (regex, the original body is long)
{
  const f = path.join(__dirname, 'server.js'); let s = fs.readFileSync(f, 'utf8');
  const a = s.indexOf('function buildLinklists() {'); const b = s.indexOf('// ---- settings');
  s = s.slice(0, a) + `function buildLinklists() {
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
const pages = { contact: { id: 95380111425, handle: 'contact', title: 'Contact', url: '/pages/contact', template_suffix: 'contact', content: '' } };
// blog "infos": real titles and excerpts from the live homepage; full article bodies were not exported
const ART = [
  ['les-differents-types-de-cuir-utilises-dans-la-fabrication-des-chaussures', 'Les Différents Types de Cuir Utilisés dans la Fabrication des Chaussures', 'Le cuir est un matériau privilégié dans la fabrication des chaussures en raison de sa durabilité, de son confort et de son esthétique. Il existe plusieurs types de cuir, chacun ayant des caractéri...'],
  ['comment-entretenir-vos-chaussures-en-cuir-pour-quelles-demeurent-comme-neuves', "Comment Entretenir Vos Chaussures en Cuir pour Qu'elles Demeurent Comme Neuves", "Investir dans une paire de chaussures en cuir de qualité est une décision judicieuse, mais pour en profiter pleinement, il est essentiel de bien les entretenir. Un entretien régulier permet non seu..."],
  ['les-chaussures-en-cuir-histoire-et-evolution', 'Les Chaussures en Cuir : Histoire et Évolution', "Les chaussures en cuir ont une longue histoire qui remonte à des milliers d'années. De simples sandales en cuir portées par nos ancêtres aux designs sophistiqués d'aujourd'hui, les chaussures en cu..."],
];
const articles = {}; const blogArticles = ART.map(([h, title, ex], i) => (articles['infos/' + h] = { id: i + 1, handle: h, title, url: '/blogs/infos/' + h, excerpt: ex, excerpt_or_content: ex, content: '<p>' + ex + '</p>', published_at: '2025-01-21T10:00:00Z', image: null, author: 'Zayou' }));
const blogs = { infos: { handle: 'infos', title: 'Conseils & entretien', url: '/blogs/infos', articles: blogArticles, articles_count: blogArticles.length } };

` + s.slice(b);
  fs.writeFileSync(f, s); console.log('server.js menus/pages/blogs replaced');
}

patch('server.js', [
  ['const ctx = { schemes, linklists };', 'const ctx = { schemes, linklists, pages, articles };'],
  ["const G = { settings, shop, routes, localization, linklists, pages, cart: new Cart(), collections: collectionsGlobal(), all_products: D.productByHandle, customer: null, images: {}, blogs: {}, articles: {},",
    "const G = { settings, shop, routes, localization, linklists, pages, cart: new Cart(), collections: collectionsGlobal(), all_products: D.productByHandle, customer: null, images: {}, blogs, articles,"],
  ["const COOKIE = 'sm_preview_cart';", "const COOKIE = 'zy_preview_cart';"],
  // no font settings in this theme (fonts are bundled)
  ["  const fonts = [G.settings.type_header_font, G.settings.type_body_font].map(f => f.family.replace(/ /g, '+'));\n  html = html.replace('</head>', `<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=${[...new Set(fonts)].map(f => f + ':ital,wght@0,300;0,400;0,500;0,600;0,700;1,400').join('&family=')}&display=swap\"></head>`);\n", ''],
  ["  if (p === '/account/login') return { page_type: 'customers/login', title: 'Connexion' };",
    "  if (p === '/blogs/infos') return { page_type: 'blog', title: blogs.infos.title, objects: { blog: blogs.infos } };\n  if ((m = p.match(/^\\/blogs\\/infos\\/([^/]+)$/)) && articles['infos/' + m[1]]) return { page_type: 'article', title: articles['infos/' + m[1]].title, objects: { blog: blogs.infos, article: articles['infos/' + m[1]] } };\n  if (p === '/policies/privacy-policy') return { page_type: 'page', title: 'Politique de confidentialité', objects: { page: { title: 'Politique de confidentialité', content: '<p>(Contenu géré par Shopify — non simulé dans l\\'aperçu.)</p>' } } };\n  if (p === '/account' || p === '/account/login') return { page_type: 'customers/login', title: 'Connexion' };"],
  // search: same Search & Discovery filters as collections
  ["  const s = { performed: !!q, terms: q, results_count: res.length, types: ['product'], filters: [],",
    "  const fq = Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k.startsWith('filter.')).map(k => [k, url.searchParams.getAll(k)]));\n  const pseudo = { all_products: res }; const filtered = D.applyFilters(res, fq);\n  const s = { performed: !!q, terms: q, results_count: filtered.length, types: ['product'], filters: q ? D.buildFilters(pseudo, { ...fq, q }, '/search') : [],"],
  ["  Object.defineProperty(s, 'results', { get() { return this._paginate ? res.slice(this._paginate.offset, this._paginate.offset + this._paginate.by) : res; } }); return s; }",
    "  const sorted = filtered.slice().sort({ 'price-ascending': (a, b) => a.price - b.price, 'price-descending': (a, b) => b.price - a.price }[s.sort_by] || (() => 0));\n  Object.defineProperty(s, 'results', { get() { return this._paginate ? sorted.slice(this._paginate.offset, this._paginate.offset + this._paginate.by) : sorted; } }); return s; }"],
]);
