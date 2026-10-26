// Lab performance on the local preview (images from the real Shopify CDN): node tools/perf.js
// Mobile profile: 390px, 4× CPU slowdown, ~1.6 Mbps / 150 ms RTT. Reports LCP, CLS, theme JS/CSS bytes, image bytes.
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:4300';
const PAGES = ['/', '/collections/baskets-homme', '/products/crest-tabac', '/pages/inspirations', '/pages/guide-des-pointures'];
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  for (const u of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const bytes = { js: 0, css: 0, img: 0, font: 0, doc: 0 };
    p.on('response', async r => { try { const t = r.request().resourceType(); const len = +(r.headers()['content-length'] || (await r.body()).length); if (t === 'script') bytes.js += len; else if (t === 'stylesheet') bytes.css += len; else if (t === 'image') bytes.img += len; else if (t === 'font') bytes.font += len; else if (t === 'document') bytes.doc += len; } catch (e) {} });
    await p.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await p.goto(BASE + u, { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const m = await p.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd) }));
    const kb = n => Math.round(n / 1024) + ' KB';
    console.log(`${u.padEnd(28)} LCP ${m.lcp} ms · CLS ${m.cls} · DCL ${m.dcl} ms · JS ${kb(bytes.js)} · CSS ${kb(bytes.css)} · fonts ${kb(bytes.font)} · images ${kb(bytes.img)}`);
    await ctx.close();
  }
  await b.close();
})();
