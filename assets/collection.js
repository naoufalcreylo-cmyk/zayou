/* ZAYOU — collection & search: AJAX filters (Section Rendering API), sort, load more, grid density,
   and browsing-state restore when coming back from a product. Works without JS through plain links and a GET form. */
(() => {
  const T = window.theme;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = $('[data-collection]'); if (!root) return;
  const sectionId = root.closest('.shopify-section').id.replace(/^shopify-section-/, '');
  const STATE_KEY = 'zayou:browse';
  const DENSITY_KEY = 'zayou:density';
  let ctrl;

  const sectionUrl = url => { const u = new URL(url, window.location.origin); u.searchParams.set('section_id', sectionId); return u.toString(); };
  const cleanUrl = url => { const u = new URL(url, window.location.origin); u.searchParams.delete('section_id'); u.searchParams.delete('page'); return u.pathname + (u.search ? u.search : ''); };

  async function fetchSection(url) {
    if (ctrl) ctrl.abort(); ctrl = new AbortController();
    const html = await (await fetch(sectionUrl(url), { signal: ctrl.signal })).text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  // ---- filters ----
  async function update(url, { push = true, keepDrawer = true } = {}) {
    root.classList.add('is-loading');
    const openFacets = $$('#filter-drawer details[open]').map(d => d.id);
    const focusedId = document.activeElement && document.activeElement.id;
    const drawerOpen = $('#filter-drawer.is-open');
    try {
      const doc = await fetchSection(url);
      const next = $('[data-collection-results]', doc); const cur = $('[data-collection-results]', root);
      if (!next || !cur) { window.location.href = url; return; }
      // keep the open drawer element (focus, scroll), swap its form content
      const curDrawer = $('#filter-drawer'), nextDrawer = $('#filter-drawer', next);
      if (drawerOpen && keepDrawer && curDrawer && nextDrawer) {
        const body = $('[data-facets-form]', curDrawer), scroll = body.scrollTop;
        body.replaceWith($('[data-facets-form]', nextDrawer));
        $('.facets__foot', curDrawer).replaceWith($('.facets__foot', nextDrawer));
        nextDrawer.remove();
        $$('#filter-drawer details').forEach(d => { if (openFacets.includes(d.id)) d.open = true; });
        $('[data-facets-form]', curDrawer).scrollTop = scroll;
        cur.replaceWith(next);
        // drawer was inside results: move the live one back into place
        const placeholder = $('#filter-drawer', next) || null; if (!placeholder) next.appendChild(curDrawer);
      } else {
        if (curDrawer && curDrawer.parentElement === document.body) curDrawer.remove();
        cur.replaceWith(next);
      }
      if (focusedId) { const f = document.getElementById(focusedId); if (f) f.focus({ preventScroll: true }); }
      const clean = cleanUrl(url);
      if (push) window.history.pushState({ zayouFacets: true }, '', clean);
      sessionStorage.removeItem(STATE_KEY);
      applyDensity(); T.size.paint(root); bindLoadMore();
      const live = $('[data-results-live]'); const count = $('[data-results-count]', root); if (live && count) live.textContent = count.textContent;
    } catch (e) { if (e.name !== 'AbortError') window.location.href = url; }
    finally { root.classList.remove('is-loading'); }
  }

  function formUrl(form) {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) { if (v === '' || v == null) continue; params.append(k, v); }
    const action = new URL(form.action, window.location.origin);
    return action.pathname + (params.toString() ? '?' + params.toString() : '');
  }
  let debounce;
  document.addEventListener('change', e => {
    const form = e.target.closest('[data-facets-form]');
    if (form) { clearTimeout(debounce); debounce = setTimeout(() => update(formUrl(form)), e.target.type === 'number' ? 600 : 0); return; }
    const sort = e.target.closest('[data-sort]');
    if (sort) {
      const u = new URL(window.location.href); u.searchParams.set('sort_by', sort.value); u.searchParams.delete('page');
      const radio = $(`[data-facets-form] input[name="sort_by"][value="${CSS.escape(sort.value)}"]`); if (radio) radio.checked = true;
      update(u.pathname + u.search, { keepDrawer: false });
    }
  });
  document.addEventListener('submit', e => { const form = e.target.closest('[data-facets-form]'); if (!form) return; e.preventDefault(); update(formUrl(form)); });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-facet-link]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); const inDrawer = a.closest('#filter-drawer');
    update(a.getAttribute('href'), { keepDrawer: !!inDrawer });
  });
  window.addEventListener('popstate', () => update(window.location.href, { push: false, keepDrawer: false }));

  // ---- load more (keeps the URL clean; restored on back navigation) ----
  function bindLoadMore() {
    const btn = $('[data-load-more]', root); if (!btn || btn._bound) return; btn._bound = true;
    btn.addEventListener('click', async e => {
      e.preventDefault(); btn.classList.add('is-loading');
      try {
        const doc = await fetchSection(btn.href); appendPage(doc);
        const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
        const pages = (s && s.url === location.pathname + location.search ? s.pages : 1) + 1;
        sessionStorage.setItem(STATE_KEY, JSON.stringify({ url: location.pathname + location.search, pages, y: window.scrollY }));
      } catch (err) { window.location.href = btn.href; }
    });
  }
  function appendPage(doc) {
    const grid = $('[data-product-grid]', root), nextGrid = $('[data-product-grid]', doc);
    const first = nextGrid && nextGrid.firstElementChild;
    if (nextGrid) grid.append(...nextGrid.children);
    const wrap = $('[data-load-more-wrap]', root), nextWrap = $('[data-load-more-wrap]', doc);
    if (wrap) { if (nextWrap) wrap.replaceWith(nextWrap); else wrap.remove(); }
    T.size.paint(root); applyDensity(); bindLoadMore();
    const link = first && first.querySelector('a.card__title'); if (link) link.focus({ preventScroll: true });
  }
  // remember scroll position before leaving for a product
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-product-card] a'); if (!card) return;
    const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ url: location.pathname + location.search, pages: s && s.url === location.pathname + location.search ? s.pages : 1, y: window.scrollY }));
  });
  async function restore() {
    const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    if (!s || s.url !== location.pathname + location.search) return;
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.type !== 'back_forward') return;
    for (let p = 2; p <= s.pages; p++) {
      const btn = $('[data-load-more]', root); if (!btn) break;
      try { appendPage(await fetchSection(btn.href)); } catch (e) { break; }
    }
    requestAnimationFrame(() => window.scrollTo(0, s.y));
  }

  // ---- density ----
  function applyDensity() {
    const d = (() => { try { return localStorage.getItem(DENSITY_KEY); } catch (e) { return null; } })() || 'small';
    $$('[data-product-grid]', root).forEach(g => { g.dataset.density = d; });
    $$('button[data-density]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.density === d ? 'true' : 'false'));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-density]'); if (!b) return;
    try { localStorage.setItem(DENSITY_KEY, b.dataset.density); } catch (err) { /* ignore */ }
    applyDensity();
  });

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  applyDensity(); bindLoadMore(); restore();
})();
