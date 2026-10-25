// node tools/montage.js <out.png> <cols> <thumbWidth> files... — contact sheet via Chrome (file:// images)
const { chromium } = require('playwright-core'); const path = require('path');
(async () => {
  const [out, cols, tw, ...files] = process.argv.slice(2);
  const html = `<body style="margin:0;background:#888;font:12px sans-serif;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:4px">` +
    files.map(f => `<figure style="margin:0;background:#fff"><img src="file:///${path.resolve(f).replace(/\\/g, '/')}" style="width:100%;display:block"><figcaption>${path.basename(f)}</figcaption></figure>`).join('') + '</body>';
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: cols * (+tw + 4), height: 600 } });
  const tmp = path.resolve(out + '.html'); require('fs').writeFileSync(tmp, html);
  await p.goto('file:///' + tmp.split(path.sep).join('/')); await p.waitForTimeout(1500);
  await p.screenshot({ path: out, fullPage: true }); await b.close();
  console.log(out);
})();
