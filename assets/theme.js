/* ZAYOU — global behaviour. No framework; progressive enhancement over working links and forms. */
(() => {
  const T = window.theme || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  const sectionIdOf = el => { const s = el && el.closest('.shopify-section'); return s ? s.id.replace(/^shopify-section-/, '') : null; };
  const parseHTML = html => new DOMParser().parseFromString(html, 'text/html');

  // ---------- money ----------
  function money(cents) {
    const fmt = T.moneyFormat || '{{amount}} DH';
    const n = (cents / 100);
    const grp = (v, d, ts, ds) => { const [i, f] = v.toFixed(d).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ts) + (d && +f ? ds + f : ''); };
    return fmt.replace(/{{\s*(\w+)\s*}}/, (_, k) => ({
      amount: grp(n, 2, ',', '.'), amount_no_decimals: grp(n, 0, ',', '.'), amount_with_comma_separator: grp(n, 2, '.', ','),
      amount_no_decimals_with_comma_separator: grp(n, 0, '.', ','), amount_with_space_separator: grp(n, 2, ' ', ','), amount_no_decimals_with_space_separator: grp(n, 0, ' ', ',')
    }[k] || grp(n, 2, ',', '.')));
  }
  T.money = money;

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $('[data-toast]'); if (!el) return;
    el.textContent = msg; el.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  T.toast = toast;

  // ---------- drawers (menu, cart, filters, search, quick add, zoom) ----------
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const openStack = [];
  function hoistDrawers(root = document) {
    // Drawers inside the sticky header would be clipped by its transform: move them to <body>
    $$('.section-header [data-drawer]', root).forEach(d => { const old = document.body.querySelector(`:scope > #${d.id}`); if (old && old !== d) old.remove(); document.body.appendChild(d); });
  }
  function openDrawer(id, trigger) {
    const d = document.getElementById(id); if (!d || d.classList.contains('is-open')) return;
    const header = $('.section-header'); if (header) header.classList.remove('is-hidden');
    d.hidden = false; d.setAttribute('aria-hidden', 'false');
    d._trigger = trigger || document.activeElement;
    requestAnimationFrame(() => d.classList.add('is-open'));
    openStack.push(d); document.body.classList.add('is-locked');
    $$(`[aria-controls="${id}"]`).forEach(b => b.setAttribute('aria-expanded', 'true'));
    const panel = $('.drawer__panel', d);
    const first = $('[autofocus], [data-predictive-input]', d) || panel;
    setTimeout(() => first && first.focus({ preventScroll: true }), reduceMotion ? 0 : 60);
    d.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
  }
  function closeDrawer(d) {
    if (!d || !d.classList.contains('is-open')) return;
    d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true');
    const i = openStack.indexOf(d); if (i > -1) openStack.splice(i, 1);
    if (!openStack.length) document.body.classList.remove('is-locked');
    $$(`[aria-controls="${d.id}"]`).forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (d._trigger && document.contains(d._trigger)) d._trigger.focus({ preventScroll: true });
    d.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));
  }
  T.openDrawer = openDrawer; T.closeDrawer = closeDrawer;
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-drawer-open]');
    if (opener) { e.preventDefault(); openDrawer(opener.dataset.drawerOpen, opener); return; }
    const closer = e.target.closest('[data-drawer-close]');
    if (closer) { const d = closer.closest('[data-drawer]'); if (d) { if (closer.type !== 'submit') e.preventDefault(); closeDrawer(d); } }
  });
  document.addEventListener('keydown', e => {
    const d = openStack[openStack.length - 1]; if (!d) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(d); return; }
    if (e.key !== 'Tab') return;
    const items = $$(FOCUSABLE, d).filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !d.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---------- header ----------
  function initHeader() {
    const wrap = $('.section-header'); const header = $('[data-header]'); if (!wrap || !header) return;
    const hideOnScroll = header.hasAttribute('data-hide-on-scroll');
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 4);
      if (hideOnScroll && !openStack.length && !header.querySelector('.nav__item.is-open')) {
        const down = y > lastY && y > 240;
        if (Math.abs(y - lastY) > 6) wrap.classList.toggle('is-hidden', down);
      }
      document.documentElement.classList.toggle('has-header-visible', !wrap.classList.contains('is-hidden'));
      lastY = y; ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    // desktop panels: hover intent + keyboard
    $$('[data-nav-item]', header).forEach(item => {
      let t;
      const open = () => { clearTimeout(t); $$('[data-nav-item].is-open', header).forEach(o => o !== item && o.classList.remove('is-open')); item.classList.add('is-open'); };
      const close = () => { t = setTimeout(() => item.classList.remove('is-open'), 140); };
      item.addEventListener('mouseenter', open); item.addEventListener('mouseleave', close);
      item.addEventListener('focusin', open); item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) item.classList.remove('is-open'); });
      item.addEventListener('keydown', e => { if (e.key === 'Escape') { item.classList.remove('is-open'); $('.nav__link', item).focus(); } });
    });
  }

  // ---------- size preference ----------
  const SIZE_KEY = 'zayou:size';
  const Size = {
    get: () => store.get(SIZE_KEY),
    set(v) { store.set(SIZE_KEY, v); Size.paint(); document.dispatchEvent(new CustomEvent('size:change', { detail: v })); },
    paint(root = document) {
      const s = Size.get();
      $$('[data-size], [data-size-pick], [data-size-value]', root).forEach(el => {
        const v = el.dataset.size || el.dataset.sizePick || el.dataset.sizeValue;
        el.classList.toggle('is-mine', !!s && v === s);
      });
      $$('[data-size-label]', root).forEach(el => el.classList.toggle('is-mine', !!s && el.dataset.sizeLabel === s));
      $$('[data-size-saved]', root).forEach(el => {
        el.hidden = !s; const t = $('[data-size-saved-text]', el);
        if (t && s) t.textContent = (T.strings.sizeSaved || 'Pointure {{ size }}').replace('{{ size }}', s);
      });
    }
  };
  T.size = Size;
  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-size-pick]'); if (pick) Size.set(pick.dataset.sizePick);
    if (e.target.closest('[data-size-forget]')) Size.set(null);
  });

  // ---------- cart ----------
  const Cart = {
    sectionIds() {
      const ids = []; if ($('[data-cart-drawer]')) ids.push('cart-drawer');
      const page = $('[data-cart-page]'); if (page) ids.push(sectionIdOf(page));
      return ids;
    },
    async request(url, body) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status) { const err = new Error(data.description || data.message || T.strings.error); err.status = res.status; throw err; }
      return data;
    },
    render(sections) {
      if (!sections) return;
      for (const [id, html] of Object.entries(sections)) {
        if (!html) continue;
        const doc = parseHTML(html);
        if (id === 'cart-drawer') {
          const cur = $('[data-cart-drawer]'); const next = $('[data-cart-drawer]', doc); if (!cur || !next) continue;
          ['.drawer__head', '[data-cart-body]'].forEach(sel => { const a = $(sel, cur), b = $(sel, next); if (a && b) a.replaceWith(b); });
          const foot = $('.drawer__foot', cur), nfoot = $('.drawer__foot', next);
          if (foot && nfoot) foot.replaceWith(nfoot); else if (foot) foot.remove(); else if (nfoot) $('.drawer__panel', cur).appendChild(nfoot);
        } else {
          const cur = $('[data-cart-page]'); const next = $('[data-cart-page]', doc); if (cur && next) cur.replaceWith(next);
        }
      }
      Size.paint();
    },
    setCount(n) { $$('[data-cart-count]').forEach(el => { el.dataset.count = n; el.textContent = n > 0 ? n : ''; }); },
    async refreshCount() { try { const c = await (await fetch(T.routes.cart + '.js', { headers: { Accept: 'application/json' } })).json(); Cart.setCount(c.item_count); return c; } catch (e) { return null; } },
    async add(items, { open = true } = {}) {
      const data = await Cart.request(T.routes.cartAdd + '.js', { items, sections: Cart.sectionIds().join(','), sections_url: window.location.pathname });
      Cart.render(data.sections);
      await Cart.refreshCount();
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { action: 'add', items } }));
      if (open && T.cartType === 'drawer' && $('[data-cart-drawer]')) openDrawer('cart-drawer');
      else toast(T.strings.added);
      return data;
    },
    async change(key, quantity, lineEl) {
      if (lineEl) lineEl.classList.add('is-busy');
      try {
        const data = await Cart.request(T.routes.cartChange + '.js', { id: key, quantity, sections: Cart.sectionIds().join(','), sections_url: window.location.pathname });
        Cart.render(data.sections); Cart.setCount(data.item_count);
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: { action: 'change' } }));
      } catch (err) {
        if (lineEl) { lineEl.classList.remove('is-busy'); const m = $('[data-line-error]', lineEl); if (m) { m.textContent = err.message; m.hidden = false; } }
        else toast(err.message);
      }
    }
  };
  T.cart = Cart;
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-cart-open]');
    if (opener && T.cartType === 'drawer' && $('[data-cart-drawer]')) { e.preventDefault(); openDrawer('cart-drawer', opener); return; }
    const step = e.target.closest('[data-qty-change]');
    if (step) { const line = step.closest('[data-cart-line]'); const input = $('[data-qty-input]', line); const q = Math.max(0, (+input.value || 0) + (+step.dataset.qtyChange)); input.value = q; Cart.change(line.dataset.cartLine, q, line); return; }
    const rm = e.target.closest('[data-line-remove]');
    if (rm) { const line = rm.closest('[data-cart-line]'); Cart.change(line.dataset.cartLine, 0, line); }
  });
  document.addEventListener('change', e => {
    const input = e.target.closest('[data-qty-input]'); if (!input) return;
    const line = input.closest('[data-cart-line]'); Cart.change(line.dataset.cartLine, Math.max(0, parseInt(input.value, 10) || 0), line);
  });

  // ---------- quick add (cards) ----------
  document.addEventListener('click', async e => {
    const chip = e.target.closest('[data-quick-add]');
    if (chip && !chip.disabled) {
      e.preventDefault(); chip.disabled = true; chip.setAttribute('aria-busy', 'true');
      try { await Cart.add([{ id: +chip.dataset.quickAdd, quantity: 1 }]); if (chip.dataset.size) Size.set(chip.dataset.size); }
      catch (err) { toast(err.message); }
      finally { chip.disabled = false; chip.removeAttribute('aria-busy'); }
      return;
    }
    const qo = e.target.closest('[data-quick-open]');
    if (qo) { e.preventDefault(); QuickAdd.open(qo.dataset.quickOpen, qo); }
  });

  const QuickAdd = {
    async open(handle, trigger) {
      const dlg = $('[data-quick-add-dialog]'); if (!dlg) { window.location.href = `${T.routes.root.replace(/\/$/, '')}/products/${handle}`; return; }
      const body = $('[data-quick-add-body]', dlg);
      body.innerHTML = `<p class="muted">…</p>`;
      openDrawer(dlg.id, trigger);
      try {
        const p = await (await fetch(`${T.routes.root.replace(/\/$/, '')}/products/${handle}.js`)).json();
        QuickAdd.render(body, p);
      } catch (err) { body.innerHTML = `<p class="form-message form-message--error">${T.strings.error}</p>`; }
    },
    render(body, p) {
      const sizeIdx = Math.max(0, (p.options || []).findIndex(o => /taille|pointure|size/i.test(typeof o === 'string' ? o : o.name)));
      const mine = Size.get();
      const img = p.featured_image ? `${p.featured_image}${p.featured_image.includes('?') ? '&' : '?'}width=240` : '';
      const onSale = p.compare_at_price && p.compare_at_price > p.price;
      body.innerHTML = `
        <div class="qa">
          <div class="qa__head">
            <div class="media media--packshot">${img ? `<img src="${img}" alt="" width="240" height="240">` : ''}</div>
            <div><p style="font-weight:500;line-height:1.3">${escapeHTML(p.title)}</p><p class="price"><span>${money(p.price)}</span>${onSale ? `<s>${money(p.compare_at_price)}</s>` : ''}</p></div>
          </div>
          <div class="qa__sizes" role="radiogroup" aria-label="${escapeHTML(T.strings.chooseSize)}">
            ${p.variants.map(v => { const s = v.options[sizeIdx]; return `<button type="button" role="radio" aria-checked="false" class="size-btn${v.available ? '' : ' is-unavailable'}${s === mine ? ' is-mine' : ''}" data-qa-variant="${v.id}" data-size="${escapeHTML(s)}" ${v.available ? '' : 'disabled'}>${escapeHTML(s)}${v.available ? '' : `<span class="visually-hidden"> — ${escapeHTML(T.strings.soldOut)}</span>`}</button>`; }).join('')}
          </div>
          <p class="qa__msg" data-qa-msg role="alert"></p>
          <button type="button" class="btn btn--lg btn--block" data-qa-add>${escapeHTML(T.strings.chooseSize)}</button>
          <a class="link small" href="${p.url || '/products/' + p.handle}">${escapeHTML(T.strings.viewProduct)}</a>
        </div>`;
      let chosen = null;
      const btn = $('[data-qa-add]', body), msg = $('[data-qa-msg]', body);
      const radios = $$('[data-qa-variant]', body);
      radios.forEach((b, i) => {
        b.addEventListener('click', () => { radios.forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); b.setAttribute('aria-pressed', 'true'); radios.forEach(x => x !== b && x.removeAttribute('aria-pressed')); chosen = b; btn.textContent = T.strings.addToCart; msg.textContent = ''; msg.classList.remove('is-error'); });
        b.addEventListener('keydown', e => {
          if (!/Arrow(Left|Right|Up|Down)/.test(e.key)) return; e.preventDefault();
          const en = radios.filter(x => !x.disabled); const j = en.indexOf(b); const n = en[(j + (/Right|Down/.test(e.key) ? 1 : en.length - 1)) % en.length]; n.focus(); n.click();
        });
      });
      btn.addEventListener('click', async () => {
        if (!chosen) { msg.textContent = T.strings.sizeRequired; msg.classList.add('is-error'); (radios.find(r => !r.disabled) || btn).focus(); return; }
        btn.classList.add('is-loading');
        try { closeDrawer($('[data-quick-add-dialog]')); await Cart.add([{ id: +chosen.dataset.qaVariant, quantity: 1 }]); Size.set(chosen.dataset.size); }
        catch (err) { openDrawer('quick-add'); msg.textContent = err.message; msg.classList.add('is-error'); }
        finally { btn.classList.remove('is-loading'); }
      });
    }
  };
  function escapeHTML(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  T.escapeHTML = escapeHTML;

  // ---------- predictive search ----------
  function initSearch() {
    const dlg = $('[data-search-dialog]'); if (!dlg) return;
    const input = $('[data-predictive-input]', dlg), results = $('[data-predictive-results]', dlg), empty = $('[data-predictive-empty]', dlg), reset = $('[data-predictive-reset]', dlg);
    let ctrl, timer, active = -1;
    document.addEventListener('click', e => { const o = e.target.closest('[data-search-open]'); if (o) { e.preventDefault(); openDrawer('search-dialog', o); } });
    const items = () => $$('[data-predictive-item]', results);
    const setActive = i => { const list = items(); list.forEach((el, j) => el.setAttribute('aria-selected', j === i ? 'true' : 'false')); active = i; if (list[i]) { input.setAttribute('aria-activedescendant', list[i].id || ''); list[i].scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant'); };
    const clear = () => { const c = $('[data-predictive-content]', results); if (c) c.remove(); empty.hidden = false; input.setAttribute('aria-expanded', 'false'); reset.hidden = true; active = -1; };
    async function query(q) {
      if (ctrl) ctrl.abort(); ctrl = new AbortController();
      const url = `${T.routes.predictiveSearch}?q=${encodeURIComponent(q)}&section_id=predictive-search&resources[type]=product,collection,query,article&resources[limit]=8&resources[limit_scope]=each&resources[options][unavailable_products]=last`;
      try {
        const html = await (await fetch(url, { signal: ctrl.signal })).text();
        const content = $('[data-predictive-content]', parseHTML(html)); if (!content) return;
        clear(); empty.hidden = true; reset.hidden = false; results.appendChild(content); input.setAttribute('aria-expanded', 'true'); active = -1;
      } catch (e) { if (e.name !== 'AbortError') clear(); }
    }
    input.addEventListener('input', () => { clearTimeout(timer); const q = input.value.trim(); if (!q) { clear(); return; } timer = setTimeout(() => query(q), 180); });
    input.addEventListener('keydown', e => {
      const list = items(); if (!list.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % list.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + list.length) % list.length); }
      else if (e.key === 'Enter' && active > -1) { e.preventDefault(); list[active].click(); }
    });
    reset.addEventListener('click', () => { setTimeout(() => { clear(); input.focus(); }, 0); });
  }

  // ---------- rails ----------
  function initRails(root = document) {
    $$('[data-rail-nav]', root).forEach(nav => {
      const rail = document.getElementById(nav.dataset.railNav); if (!rail || nav._init) return; nav._init = true;
      const prev = $('[data-rail-prev]', nav), next = $('[data-rail-next]', nav);
      const sync = () => { prev.disabled = rail.scrollLeft <= 2; next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2; nav.hidden = rail.scrollWidth <= rail.clientWidth + 2; };
      const by = dir => rail.scrollBy({ left: dir * rail.clientWidth * 0.85, behavior: reduceMotion ? 'auto' : 'smooth' });
      prev.addEventListener('click', () => by(-1)); next.addEventListener('click', () => by(1));
      rail.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true }); window.addEventListener('resize', sync); sync();
    });
  }

  // ---------- model spotlight (tabs) ----------
  function initSpotlights(root = document) {
    $$('[data-spotlight]', root).forEach(sec => {
      const tabs = $$('[data-spot-tab]', sec); if (!tabs.length) return;
      const show = tab => {
        tabs.forEach(t => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        tabs.forEach(t => t.tabIndex = t === tab ? 0 : -1);
        $$('[data-spot-panel]', sec).forEach(p => { p.hidden = p.dataset.spotPanel !== tab.dataset.spotTab; });
      };
      tabs.forEach((t, i) => {
        t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
        t.addEventListener('click', () => show(t));
        t.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) show(t); });
        t.addEventListener('keydown', e => { if (!/Arrow(Left|Right)|Home|End/.test(e.key)) return; e.preventDefault(); const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[j].focus(); show(tabs[j]); });
      });
    });
  }

  // ---------- product recommendations ----------
  function initRecos(root = document) {
    $$('[data-recos]', root).forEach(async el => {
      if (el._loaded) return; el._loaded = true;
      try {
        const doc = parseHTML(await (await fetch(el.dataset.url)).text());
        const next = $('[data-recos]', doc);
        if (next && next.innerHTML.trim()) { el.innerHTML = next.innerHTML; el.hidden = false; initRails(el); Size.paint(el); }
      } catch (e) { /* recommendations are optional */ }
    });
  }

  // ---------- init ----------
  function init(root = document) { initRails(root); initSpotlights(root); initRecos(root); Size.paint(root); }
  document.addEventListener('DOMContentLoaded', () => { hoistDrawers(); initHeader(); initSearch(); init(); });
  document.addEventListener('shopify:section:load', e => { hoistDrawers(e.target); init(e.target); if (e.target.querySelector('[data-header]')) initHeader(); });
  window.addEventListener('pageshow', e => { if (e.persisted) Cart.refreshCount(); });
})();
