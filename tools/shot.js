// node tools/shot.js <path> <width> [out.png] [--full] [--scroll=Y] [--click=selector] — screenshot of the local preview (Chrome)
const { chromium } = require('playwright-core'); const path = require('path');
(async () => {
  const args = process.argv.slice(2); const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const [p = '/', w = '1440', out] = args.filter(a => !a.startsWith('--'));
  const base = process.env.BASE || 'http://localhost:4300';
  const b = await chromium.launch({ channel: 'chrome' });
  const page = await b.newPage({ viewport: { width: +w, height: +w < 750 ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: +w < 990, isMobile: +w < 750 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + p, { waitUntil: 'networkidle' });
  if (flags.full) { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); }); await page.waitForTimeout(800); }
  if (flags.scroll) { await page.evaluate(y => window.scrollTo(0, +y), flags.scroll); await page.waitForTimeout(400); }
  if (flags.click) { await page.click(flags.click); await page.waitForTimeout(600); }
  await page.waitForTimeout(500);
  const file = out || path.join(__dirname, '../qa/shots', `${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${w}.png`);
  require('fs').mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: !!flags.full });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(file, overflow > 0 ? `OVERFLOW ${overflow}px` : 'no-overflow', errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
  await b.close();
})();
