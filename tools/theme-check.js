// node tools/theme-check.js [dir=theme] — Shopify Theme Check (official @shopify/theme-check-node), whole theme.
const path = require('path');
const { themeCheckRun } = require('@shopify/theme-check-node');
const dir = path.resolve(process.argv[2] || 'theme');
(async () => {
  const { offenses } = await themeCheckRun(dir, undefined, () => {});
  const sev = ['error', 'warning', 'info'];
  const by = {}; for (const o of offenses) { const k = `${sev[o.severity] || o.severity} ${o.check}`; (by[k] = by[k] || []).push(o); }
  for (const [k, os] of Object.entries(by).sort()) { console.log(`${k} (${os.length})`); os.slice(0, 8).forEach(o => console.log(`   ${o.uri.replace(/\\/g, '/').split('/theme/').pop()}:${(o.start?.line ?? 0) + 1}  ${o.message.slice(0, 170)}`)); }
  console.log(`\n${offenses.length} offenses (${offenses.filter(o => o.severity === 0).length} errors, ${offenses.filter(o => o.severity === 1).length} warnings)`);
  process.exit(offenses.some(o => o.severity === 0) ? 1 : 0);
})();
