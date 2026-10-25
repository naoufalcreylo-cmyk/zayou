// Vercel entry: the real theme Liquid rendered by the preview harness (tools/preview) on the real ZAYOU catalogue.
// On the `main` branch the theme folders sit at the repository root, hence THEME_DIR='.'.
// This is a demo of the theme, not the store: checkout, customer accounts and apps (EasySell) are not emulated.
process.env.THEME_DIR = process.env.THEME_DIR || '.';
module.exports = require('../tools/preview/server.js');
