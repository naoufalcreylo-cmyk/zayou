// Real-store check: quick add → cart drawer → quantity → checkout page loads (no details entered, no order). node tools/live-cart.js <theme_id>
const { chromium } = require('playwright-core');
(async () => {
  const id = process.argv[2]; const S = 'https://zayou-5.myshopify.com';
  const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); const r = {};
  await p.goto(`${S}/collections/baskets-homme?preview_theme_id=${id}`, { waitUntil: 'networkidle' });
  r.cards = (await p.$$('[data-product-card]')).length; r.sizeChipsInToolbar = (await p.$$('.toolbar__size')).length; r.filters = await p.$$eval('#filter-drawer .facet__title span', s => s.map(x => x.textContent.trim()));
  const card = await p.$('[data-product-card]:has([data-quick-add]:not([disabled]))'); await card.hover();
  const chip = await card.$('[data-quick-add]:not([disabled])'); r.size = await chip.getAttribute('data-size'); r.product = await card.getAttribute('data-handle');
  await chip.click(); await p.waitForSelector('#cart-drawer.is-open', { timeout: 10000 }).catch(() => {});
  r.drawer = await p.isVisible('#cart-drawer.is-open'); r.line = (await p.textContent('#cart-drawer [data-cart-line]').catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 80);
  await p.click('#cart-drawer [data-qty-change="1"]'); await p.waitForTimeout(2500);
  r.qty = await p.$eval('#cart-drawer [data-qty-input]', i => i.value); r.total = (await p.textContent('#cart-drawer [data-cart-total]')).trim();
  const cart = await (await p.request.get(`${S}/cart.js`)).json(); r.cartApi = cart.items.map(i => `${i.handle} ${i.variant_title} ×${i.quantity}`);
  await Promise.all([p.waitForURL(/checkouts|checkout/, { timeout: 20000 }).catch(() => {}), p.click('#cart-drawer button[name="checkout"]')]);
  await p.waitForLoadState('networkidle').catch(() => {}); r.checkoutUrl = p.url().replace(/\?.*/, '').replace(/[a-z0-9]{20,}/gi, '…'); r.checkoutLoaded = /checkouts?\//.test(p.url());
  await p.screenshot({ path: 'qa/shots/live-checkout.png' });
  await p.request.post(`${S}/cart/clear.js`); r.jsErrors = errs.slice(0, 3);
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
