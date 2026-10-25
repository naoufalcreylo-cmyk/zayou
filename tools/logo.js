// Logo variants from the supplied file (brand/zayou-logo-original.png): tight crop + white→alpha. No resampling of the mark.
// node tools/logo.js → theme/assets/zayou-logo-{black,white}.png, brand/logo-info.json
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
(async () => {
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../brand/zayou-logo-original.png')).toString('base64');
  const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage();
  const out = await p.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height); let minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) { const o = (y * c.width + i) * 4; const lum = 255 - (255 - (d.data[o] + d.data[o + 1] + d.data[o + 2]) / 3) * d.data[o + 3] / 255; if (lum < 200) { minX = Math.min(minX, i); maxX = Math.max(maxX, i); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
    const pad = 2; minX -= pad; minY -= pad; maxX += pad; maxY += pad; const w = maxX - minX + 1, h = maxY - minY + 1;
    const mk = rgb => { const o = document.createElement('canvas'); o.width = w; o.height = h; const ox = o.getContext('2d'); const id = ox.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const s = ((y + minY) * c.width + (i + minX)) * 4, t = (y * w + i) * 4; const lum = 255 - (255 - (d.data[s] + d.data[s + 1] + d.data[s + 2]) / 3) * d.data[s + 3] / 255; id.data[t] = rgb; id.data[t + 1] = rgb; id.data[t + 2] = rgb; id.data[t + 3] = Math.round(255 - lum); }
      ox.putImageData(id, 0, 0); return o.toDataURL('image/png'); };
    let ink = [0, 0, 0], n = 0; for (let y = minY; y <= maxY; y++) for (let i = minX; i <= maxX; i++) { const o = (y * c.width + i) * 4; if (d.data[o + 3] > 250 && (d.data[o] + d.data[o + 1] + d.data[o + 2]) / 3 < 40) { ink[0] += d.data[o]; ink[1] += d.data[o + 1]; ink[2] += d.data[o + 2]; n++; } }
    return { w, h, black: mk(0), white: mk(255), ink: ink.map(v => Math.round(v / n)), source: [img.width, img.height] };
  }, src);
  const save = (n, u) => fs.writeFileSync(path.join(__dirname, '../theme/assets', n), Buffer.from(u.split(',')[1], 'base64'));
  save('zayou-logo-black.png', out.black); save('zayou-logo-white.png', out.white);
  fs.writeFileSync(path.join(__dirname, '../brand/logo-info.json'), JSON.stringify({ width: out.w, height: out.h, ratio: +(out.w / out.h).toFixed(4), ink_rgb: out.ink, source: out.source }, null, 1));
  console.log(out.w, out.h, out.ink); await b.close();
})();
