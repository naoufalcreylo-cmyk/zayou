// Real-store check of the EasySell COD flow on the unpublished theme (never submits an order).
// node tools/live-easysell.js <theme_id> [product-handle]
const { chromium } = require('playwright-core');
(async () => {
  const [id, handle = 'crest-tabac'] = process.argv.slice(2);
  const b = await chromium.launch({ channel: 'chrome' });
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`https://zayou-5.myshopify.com/products/${handle}?preview_theme_id=${id}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('#es-popup-button, [id^="es-popup-button"]', { timeout: 15000 }).catch(() => {});
    const r = {};
    r.esButton = await p.$$eval('#es-popup-button, [id^="es-popup-button"]', els => els.filter(e => e.offsetParent).map(e => e.textContent.trim().slice(0, 40)));
    r.addToCartHidden = await p.$eval('[data-add-button]', b => getComputedStyle(b).display === 'none');
    r.variantBefore = await p.evaluate(() => window.EasySellHelpers && window.EasySellHelpers.getVariantId());
    const btn = await p.$('#es-popup-button, [id^="es-popup-button"]');
    if (btn) { await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(1500); }
    r.blockedShowsSizeError = await p.isVisible('[data-size-error]');
    r.popupOpenedWithoutSize = await p.evaluate(() => [...document.querySelectorAll('#es-form-popup, .es-popup, [id*="es-form"], .es-modal')].some(e => e.offsetParent || getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 200));
    const size = await p.$('[data-size-input]:not([disabled])');
    const sizeVal = await size.getAttribute('data-size'); const vid = await size.getAttribute('value');
    await p.click(`label[for="${await size.getAttribute('id')}"]`);
    r.chosen = sizeVal; r.variantAfterMatches = String(await p.evaluate(() => window.EasySellHelpers && window.EasySellHelpers.getVariantId())) === vid;
    if (btn) { await btn.click(); await p.waitForTimeout(2500); }
    r.popupOpenedWithSize = await p.evaluate(() => [...document.querySelectorAll('[id*="es-form"], .es-popup, .es-modal, [class*="es-form"]')].some(e => e.getBoundingClientRect().height > 200));
    r.popupShowsChosenSize = await p.evaluate(s => document.body.innerText.includes(s), sizeVal);
    await p.screenshot({ path: `qa/shots/live-easysell-${vp.width}.png` });
    r.stickyApp = await p.evaluate(() => !!document.querySelector('.es-sticky'));
    r.themeBuyBarHidden = await p.evaluate(() => document.documentElement.classList.contains('has-app-sticky'));
    r.jsErrors = errs.slice(0, 3);
    console.log(vp.width, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
