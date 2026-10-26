// Internal link crawler: node tools/links.js [BASE]
// Follows links from every internal page without query string; URLs with a query (filters, sort, variant, size, search)
// are status-checked but not expanded. Reports non-200 links and in-page anchors (#id) with no target.
const BASE = process.env.BASE || process.argv[2] || 'http://localhost:4300';
const origin = new URL(BASE).origin;
const status = new Map(); const queued = new Set(['/']); const queue = ['/']; const anchorChecks = new Set(); const htmlCache = new Map();
const norm = href => { try { const u = new URL(href, BASE); if (u.origin !== origin) return null; if (/^\/(cdn|assets|checkout|cart\/|account\/logout|shop_images)/.test(u.pathname)) return null; return u.pathname + u.search; } catch (e) { return null; } };
async function visit(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' }); status.set(path, res.status);
  if (res.status >= 300 || path.includes('?')) return;
  if (!(res.headers.get('content-type') || '').includes('html')) return;
  const html = await res.text(); htmlCache.set(path, html);
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/^(mailto|tel|https?:\/\/(?!localhost))/.test(href) && !href.startsWith(origin)) continue;
    const [p, hash] = href.split('#'); const n = p ? norm(p) : path; if (!n) continue;
    if (hash) anchorChecks.add(`${n.split('?')[0]}#${hash}|${path}`);
    if (!queued.has(n)) { queued.add(n); queue.push(n); }
  }
}
(async () => {
  while (queue.length) { const batch = queue.splice(0, 12); await Promise.all(batch.map(visit)); }
  const broken = [...status].filter(([, s]) => s >= 400).map(([p, s]) => `${s} ${p}`);
  const missing = [];
  for (const a of anchorChecks) {
    const [target, from] = a.split('|'); const [p, id] = target.split('#'); if (!id) continue;
    let html = htmlCache.get(p); if (html === undefined) { html = await (await fetch(BASE + p)).text(); htmlCache.set(p, html); }
    if (!html.includes(`id="${id}"`)) missing.push(`${target} (from ${from})`);
  }
  const paths = [...status.keys()];
  console.log(`${status.size} internal URLs checked · ${paths.filter(p => !p.includes('?')).length} pages crawled (${paths.filter(p => /^\/products\/[^?]+$/.test(p)).length} products, ${paths.filter(p => p.startsWith('/pages/')).length} content pages, ${paths.filter(p => /^\/collections\/[^?]+$/.test(p)).length} collections)`);
  console.log(broken.length ? 'BROKEN:\n  ' + broken.join('\n  ') : 'No broken internal links.');
  console.log(missing.length ? 'MISSING ANCHORS:\n  ' + [...new Set(missing)].join('\n  ') : 'All anchors resolve.');
  process.exit(broken.length || missing.length ? 1 : 0);
})();
