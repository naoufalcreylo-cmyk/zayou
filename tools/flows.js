// Interaction tests against the local preview: node tools/flows.js  (BASE=http://localhost:4300)
// Includes a compatibility test with the real EasySell helpers.js (downloaded from the live store's app embed).
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4300';
const catalog = require('../data/catalog.json');
const results = []; let failures = 0;
const ok = (name, cond, info = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctxDesk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxMob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); return p; };

  // ---------- PDP: size required, explicit selection, cart ----------
  const crest = catalog.products.find(p => p.handle === 'crest-tabac');
  const v42 = crest.variants.find(v => v.option1 === '42');
  let p = watch(await ctxDesk.newPage());
  await p.goto(BASE + '/products/crest-tabac', { waitUntil: 'networkidle' });
  ok('PDP: no size preselected', (await p.$eval('[data-variant-input]', i => i.value)) === '');
  await p.click('[data-add-button]');
  ok('PDP: add without size shows error', await p.isVisible('[data-size-error]'));
  ok('PDP: add without size adds nothing', (await (await p.request.get(BASE + '/cart.js')).json()).item_count === 0);
  await p.click(`label[for$="-${v42.id}"]`);
  ok('PDP: selecting 42 sets variant id (value + attribute)', await p.$eval('[data-variant-input]', (i, id) => i.value === String(id) && i.getAttribute('value') === String(id), v42.id));
  ok('PDP: URL carries ?variant=', p.url().includes('variant=' + v42.id));
  ok('PDP: error cleared after selection', !(await p.isVisible('[data-size-error]')));
  await p.click('[data-add-button]'); await p.waitForSelector('#cart-drawer.is-open', { timeout: 5000 }).catch(() => {});
  ok('Cart: drawer opens after add', await p.isVisible('#cart-drawer.is-open'));
  const lineText = await p.textContent('#cart-drawer [data-cart-line]').catch(() => '');
  ok('Cart: line shows product, size 42 and colour', /Crest - Tabac/.test(lineText) && /Pointure : 42/.test(lineText) && /Tabac/.test(lineText), lineText.replace(/\s+/g, ' ').trim().slice(0, 90));
  ok('Cart: header count = 1', (await p.textContent('[data-cart-count]')).trim() === '1');
  ok('Size memory: 42 saved after explicit choice', (await p.evaluate(() => localStorage.getItem('zayou:size'))) === '42');
  await p.click('#cart-drawer [data-qty-change="1"]'); await p.waitForTimeout(700);
  ok('Cart: + increments quantity to 2', (await p.$eval('#cart-drawer [data-qty-input]', i => i.value)) === '2');
  ok('Cart: subtotal updates (2 × 299)', /598/.test(await p.textContent('#cart-drawer [data-cart-total]')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('A11y: Escape closes drawer', !(await p.isVisible('#cart-drawer.is-open')));
  await p.goto(BASE + '/cart', { waitUntil: 'networkidle' });
  ok('Cart page lists the item with a checkout button', (await p.$$('[data-cart-page] [data-cart-line]')).length === 1 && await p.isVisible('[data-cart-page] button[name="checkout"]'));
  await p.click('[data-cart-page] [data-line-remove]'); await p.waitForTimeout(800);
  ok('Cart page: remove empties the cart', /vide/.test(await p.textContent('[data-cart-page]')));

  // sold-out size and sold-out product
  const partly = catalog.products.find(x => x.options[0].name === 'Taille' && x.variants.some(v => v.available) && x.variants.some(v => !v.available));
  await p.goto(BASE + '/products/' + partly.handle, { waitUntil: 'networkidle' });
  const so = partly.variants.find(v => !v.available);
  ok(`PDP: sold-out size ${so.option1} disabled and labelled (${partly.handle})`, await p.$eval(`input[value="${so.id}"]`, i => i.disabled) && /épuisé/i.test(await p.textContent(`label[for$="-${so.id}"]`)));
  const soldOut = catalog.products.find(x => !x.available && x.options[0].name === 'Taille');
  await p.goto(BASE + '/products/' + soldOut.handle, { waitUntil: 'networkidle' });
  ok(`PDP: sold-out product button disabled (${soldOut.handle})`, await p.$eval('[data-add-button]', b => b.disabled && /Épuisé/.test(b.textContent)));

  // remembered size is marked, not selected; carried across colourways
  await p.goto(BASE + '/products/crest-kaki', { waitUntil: 'networkidle' });
  ok('Size memory: marked on another product, not preselected', (await p.$eval('[data-variant-input]', i => i.value)) === '' && await p.isVisible('[data-size-mine]'));
  await p.goto(BASE + '/products/crest-kaki?size=43', { waitUntil: 'networkidle' });
  const kaki43 = catalog.products.find(x => x.handle === 'crest-kaki').variants.find(v => v.option1 === '43');
  ok('Colourway switch carries an explicit size choice (?size=43)', (await p.$eval('[data-variant-input]', i => i.value)) === String(kaki43.available ? kaki43.id : ''));

  // ---------- EasySell compatibility (real helpers.js) ----------
  // EasySell's helpers.js is third-party code: kept locally (research/easysell/), not in the repository
  const helpersPath = path.join(__dirname, '../research/easysell/helpers.js');
  if (!fs.existsSync(helpersPath)) { results.push('SKIP  EasySell compatibility (research/easysell/helpers.js absent — download it from the live store app embed)'); }
  else {
  const helpers = fs.readFileSync(helpersPath, 'utf8');
  await p.goto(BASE + '/products/crest-tabac', { waitUntil: 'networkidle' });
  await p.evaluate(() => {
    const prod = JSON.parse(document.querySelector('[data-product-json]').textContent);
    window.ES_INITIAL_PRODUCT = { id: prod.id, variants: prod.variants.map(v => ({ id: v.id })) };
    window.ShopifyAnalytics = { meta: { selectedVariantId: null } };
    window.EASYSELL_CONFIG = { settings: {} };
    const form = document.querySelector('[data-product-form]');
    form.insertAdjacentHTML('afterend', '<button id="es-popup-button" type="button">Commander maintenant</button>');
    window.__esClicks = 0; document.getElementById('es-popup-button').addEventListener('click', () => { window.__esClicks++; });
  });
  await p.addScriptTag({ content: helpers, type: 'module' }); await p.waitForFunction(() => window.EasySellHelpers);
  const esBefore = await p.evaluate(() => { window.ES_CLOSEST_FORM = document.querySelector('[data-product-form]'); return window.EasySellHelpers.getVariantId(); });
  ok('EasySell: before a size is chosen, the form gives the app no variant', esBefore == null, `getVariantId() → ${esBefore}`);
  await p.click('#es-popup-button');
  ok('EasySell: COD button blocked without size (app handler not reached)', (await p.evaluate(() => window.__esClicks)) === 0);
  ok('EasySell: blocked click shows the size message', await p.isVisible('[data-size-error]'));
  const v43 = crest.variants.find(v => v.option1 === '43');
  await p.click(`label[for$="-${v43.id}"]`);
  const esAfter = await p.evaluate(() => window.EasySellHelpers.getVariantId());
  ok('EasySell: after choosing 43, app reads the 43 variant', String(esAfter) === String(v43.id), `getVariantId() → ${esAfter}`);
  await p.click('#es-popup-button');
  ok('EasySell: COD button works once a size is chosen', (await p.evaluate(() => window.__esClicks)) === 1);
  await p.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<button class="es-sticky es-sticky-product">Commander</button>'));
  await p.waitForTimeout(200);
  ok('EasySell: app sticky button detected → theme bar yields', await p.evaluate(() => document.documentElement.classList.contains('has-app-sticky')));
  }
  await p.close();

  // ---------- Collection: filters, load more, state restore ----------
  p = watch(await ctxDesk.newPage());
  await p.goto(BASE + '/collections/baskets-homme', { waitUntil: 'networkidle' });
  const before = (await p.$$('[data-product-grid] > li')).length;
  await p.click('.toolbar__size[data-size-value="45"]'); await p.waitForTimeout(900);
  ok('Collection: size chip 45 filters via AJAX + URL', p.url().includes('filter.v.option.taille=45') && (await p.$$('[data-product-grid] > li')).length < before);
  ok('Collection: active filter pill + clear all', await p.isVisible('.active-filters .pill') && await p.isVisible('.active-filters .link'));
  await p.click('.active-filters .link'); await p.waitForTimeout(900);
  ok('Collection: clear all restores', !p.url().includes('filter.') && (await p.$$('[data-product-grid] > li')).length === before);
  await p.click('[data-drawer-open="filter-drawer"]'); await p.waitForTimeout(300);
  await p.check('#filter-drawer input[name="filter.v.availability"][value="1"]'); await p.waitForTimeout(900);
  ok('Filter drawer: stays open while filtering', await p.isVisible('#filter-drawer.is-open'));
  ok('Filter drawer: in-stock filter applied', p.url().includes('filter.v.availability=1'));
  await p.keyboard.press('Escape');
  await p.goto(BASE + '/collections/baskets-homme', { waitUntil: 'networkidle' });
  await p.click('[data-load-more]'); await p.waitForTimeout(1000);
  const afterMore = (await p.$$('[data-product-grid] > li')).length;
  ok('Collection: load more appends next page', afterMore > before, `${before} → ${afterMore}`);
  await p.evaluate(() => window.scrollTo(0, 2600));
  await p.click('[data-product-grid] > li:nth-child(30) .card__title'); await p.waitForLoadState('networkidle');
  await p.goBack({ waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  ok('Collection: back from product restores loaded pages', (await p.$$('[data-product-grid] > li')).length === afterMore);
  ok('Collection: back restores scroll position', (await p.evaluate(() => window.scrollY)) > 1500);
  // desktop hover quick add (explicit size)
  await p.goto(BASE + '/collections/baskets-homme', { waitUntil: 'networkidle' });
  const card = await p.$('[data-product-card]:has([data-quick-add]:not([disabled]))');
  await card.hover(); const chip = await card.$('[data-quick-add]:not([disabled])'); const chipSize = await chip.getAttribute('data-size');
  await chip.click(); await p.waitForSelector('#cart-drawer.is-open', { timeout: 5000 }).catch(() => {});
  ok('Card quick add (desktop hover): adds the chosen size', new RegExp('Pointure : ' + chipSize).test(await p.textContent('#cart-drawer [data-cart-body]')));
  await p.request.post(BASE + '/cart/clear.js');
  await p.close();

  // ---------- Search ----------
  p = watch(await ctxDesk.newPage());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('.header__search-field'); await p.waitForTimeout(400); await p.keyboard.type('crest', { delay: 40 }); await p.waitForTimeout(900);
  ok('Predictive search: suggests Crest products', (await p.$$('[data-predictive-results] .predictive__product')).length >= 3);
  await p.keyboard.press('ArrowDown'); await Promise.all([p.waitForNavigation({ timeout: 5000 }).catch(() => {}), p.keyboard.press('Enter')]);
  ok('Predictive search: keyboard Enter opens selection', !p.url().endsWith(BASE + '/'), p.url().replace(BASE, ''));
  await p.goto(BASE + '/search?q=zzzz', { waitUntil: 'networkidle' });
  ok('Search: empty state with help + categories + suggestions', /Aucun résultat/.test(await p.textContent('main')) && (await p.$$('main .chip-link')).length >= 4 && (await p.$$('main [data-product-card]')).length > 0);
  await p.close();

  // ---------- Mobile ----------
  p = watch(await ctxMob.newPage());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.click('.header__menu-toggle'); await p.waitForTimeout(400);
  ok('Mobile menu: drawer opens, empty "best sellers" hidden, no "Accueil"', await p.isVisible('#menu-drawer.is-open') && !/best sellers|Accueil/.test(await p.textContent('#menu-drawer .mnav')));
  await p.keyboard.press('Escape');
  await p.goto(BASE + '/collections/sandales-homme', { waitUntil: 'networkidle' });
  await p.click('[data-product-card] [data-quick-open]'); await p.waitForSelector('#quick-add.is-open [data-qa-add]');
  await p.click('#quick-add [data-qa-add]');
  ok('Mobile quick add: refuses to add without size', /pointure/i.test(await p.textContent('#quick-add [data-qa-msg]')));
  await p.click('#quick-add [data-qa-variant]:not([disabled])'); await p.click('#quick-add [data-qa-add]');
  await p.waitForSelector('#cart-drawer.is-open', { timeout: 5000 }).catch(() => {});
  ok('Mobile quick add: adds once a size is chosen', (await (await p.request.get(BASE + '/cart.js')).json()).item_count === 1);
  await p.request.post(BASE + '/cart/clear.js');
  await p.goto(BASE + '/products/crest-tabac', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(600);
  ok('Mobile buy bar: appears after scrolling past the button', await p.isVisible('[data-buybar].is-visible'));
  await p.click('[data-buybar-btn]', { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(700);
  ok('Mobile buy bar: without size it leads to the size picker', await p.isVisible('[data-size-error]'));
  await p.close();

  ok('No JavaScript errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n')); console.log(`\n${results.length - failures}/${results.length} passed`);
  await browser.close(); process.exit(failures ? 1 : 0);
})();
