// v2 adaptation of the preview (run once, kept for traceability): content pages, vendor collections, form posts, full articles.
const fs = require('fs'); const path = require('path');
function patch(file, pairs) {
  const f = path.join(__dirname, file); let s = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(`${file}: not found: ${a.slice(0, 90)}`); s = s.replace(a, b); }
  fs.writeFileSync(f, s); console.log(file, 'patched');
}
patch('server.js', [
  // pages that the merchant creates in Shopify admin (handle + template); their content lives in the theme sections
  ["const pages = { contact: { id: 95380111425, handle: 'contact', title: 'Contact', url: '/pages/contact', template_suffix: 'contact', content: '' } };",
    `const PAGE = (id, handle, title, template_suffix) => ({ id, handle, title, url: '/pages/' + handle, template_suffix, content: '' });
const pages = { contact: PAGE(95380111425, 'contact', 'Contact', 'contact'), 'a-propos': PAGE(1, 'a-propos', 'À propos de zayou', 'about'), 'guide-des-pointures': PAGE(2, 'guide-des-pointures', 'Guide des pointures', 'size-guide'),
  entretien: PAGE(3, 'entretien', 'Conseils d’entretien', 'care'), inspirations: PAGE(4, 'inspirations', 'Inspirations', 'style'), faq: PAGE(5, 'faq', 'Questions fréquentes', 'faq') };`],
  // full article bodies fetched from the live store (research/articles.json)
  ["const articles = {}; const blogArticles = ART.map(([h, title, ex], i) => (articles['infos/' + h] = { id: i + 1, handle: h, title, url: '/blogs/infos/' + h, excerpt: ex, excerpt_or_content: ex, content: '<p>' + ex + '</p>', published_at: '2025-01-21T10:00:00Z', image: null, author: 'Zayou' }));",
    `const ARTX = (() => { try { return require('../../data/articles.json'); } catch (e) { return {}; } })();
const articles = {}; const blogArticles = ART.map(([h, title, ex], i) => (articles['infos/' + h] = { id: i + 1, handle: h, title, url: '/blogs/infos/' + h, excerpt: ex, excerpt_or_content: ex, content: (ARTX[h] && ARTX[h].content) || '<p>' + ex + '</p>', published_at: '2024-10-24T10:00:00Z', image: ARTX[h] && ARTX[h].image ? new D.Img(ARTX[h].image, { width: 520, height: 500 }) : null, author: 'Zayou' }));`],
  // Shopify vendor / type collections: /collections/vendors?q=Broski
  ["  if (p === '/collections') return { page_type: 'list-collections', title: 'Collections' };",
    `  if (p === '/collections') return { page_type: 'list-collections', title: 'Collections' };
  if ((p === '/collections/vendors' || p === '/collections/types') && url.searchParams.get('q')) {
    const q = url.searchParams.get('q'); const key = p.endsWith('vendors') ? 'vendor' : 'type';
    const handles = Object.values(D.productByHandle).filter(x => String(x[key]).toLowerCase() === q.toLowerCase()).map(x => x.handle);
    const c = D.makeCollection({ handle: p.split('/').pop(), title: q, product_handles: handles }); c.url = p + '?q=' + encodeURIComponent(q);
    c._query = Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k !== 'q').map(k => [k, url.searchParams.getAll(k)])); c.sort_by = url.searchParams.get('sort_by') || '';
    c.filters = D.buildFilters(c, Object.fromEntries([...new Set(url.searchParams.keys())].filter(k => k.startsWith('filter.')).map(k => [k, url.searchParams.getAll(k)])), c.url);
    return { page_type: 'collection', title: q, handle: c.handle, objects: { collection: c } };
  }`],
  // contact + newsletter forms: Shopify redirects back with ?contact_posted=true / ?customer_posted=true
  ["    if (p === '/localization' && req.method === 'POST')",
    `    if (p === '/contact' && req.method === 'POST') { const body = parseBody(await readBody(req), req.headers['content-type']); const back = new URL(req.headers.referer || origin() + '/');
      const isCustomer = body.form_type === 'customer'; back.searchParams.set(isCustomer ? 'customer_posted' : 'contact_posted', 'true'); back.hash = isCustomer ? 'footer-newsletter' : 'contact-form';
      return send(res, 302, '', 'text/plain', { Location: back.pathname + back.search + back.hash }); }
    if (p === '/localization' && req.method === 'POST')`],
]);
patch('engine.js', [
  ["  ctx.push({ form: { errors: null, 'posted_successfully?': false, email: '', body: '', name: '', id: attrs.id } });",
    "  const q = ctx.globals._query || {}; const posted = (type === 'customer' && q.customer_posted === 'true') || (type === 'contact' && q.contact_posted === 'true');\n  ctx.push({ form: { errors: null, 'posted_successfully?': posted, email: '', body: '', name: '', id: attrs.id } });"],
]);
patch('drops.js', [
  ["module.exports = { UNPUB,", "module.exports = { makeCollection, UNPUB,"],
]);
