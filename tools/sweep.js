// Responsive + accessibility sweep: node tools/sweep.js
// For each page × width: horizontal overflow, small touch targets (< 24px, WCAG 2.2 AA 2.5.8), images without dimensions, axe-core violations.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4300';
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['/', '/pages/a-propos', '/pages/guide-des-pointures', '/pages/entretien', '/pages/inspirations', '/pages/faq', '/collections/mocassins-homme', '/collections/vendors?q=Broski', '/collections/baskets-homme', '/collections/baskets-homme?filter.v.option.taille=42&filter.v.availability=1', '/products/crest-tabac', '/products/sandales-homme-009-daim-tabac', '/products/khamrah-100-ml', '/search?q=mocassin', '/search?q=zzzz', '/cart', '/pages/contact', '/blogs/infos', '/account/login', '/nope'];
const WIDTHS = [360, 390, 768, 1024, 1440];
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }); const rows = []; const axeAll = {};
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 750 ? 800 : 900 }, isMobile: w < 750, hasTouch: w < 1024 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    for (const u of PAGES) {
      await p.goto(BASE + u, { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"], [hidden]'); };
        const small = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, summary, label.size-btn')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); if (el.closest('.rte, .breadcrumbs, p, li.footer__links, .footer__links, .cart-line__opts')) return false; return r.width < 24 || r.height < 24; }).map(el => (el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
        const noDims = [...document.images].filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length;
        return { overflow: document.documentElement.scrollWidth - innerWidth, small: [...new Set(small)].slice(0, 4), noDims };
      });
      let violations = [];
      if (w === 390 || w === 1440) {
        await p.addScriptTag({ content: axe });
        violations = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes[0].target.join(' ') })));
        for (const v of violations) (axeAll[v.id] ||= { impact: v.impact, pages: new Set(), sample: v.t }).pages.add(`${u}@${w}`);
      }
      rows.push(`${w}\t${u}\t${r.overflow > 0 ? 'OVERFLOW ' + r.overflow : 'ok'}\tsmall:${r.small.length ? r.small.join(',') : '0'}\tnoDimImg:${r.noDims}\taxe:${violations.length}${errs.length ? '\tJS:' + errs.join('|') : ''}`);
      errs.length = 0;
    }
    await ctx.close();
  }
  console.log(rows.join('\n'));
  console.log('\naxe violations:'); for (const [id, v] of Object.entries(axeAll)) console.log(`  ${v.impact} ${id} (${v.pages.size} page/width) e.g. ${v.sample} on ${[...v.pages][0]}`);
  await b.close();
})();
