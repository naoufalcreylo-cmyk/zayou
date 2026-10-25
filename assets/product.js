/* ZAYOU — product page: size selection, cart, ordering-app guard, gallery, zoom, mobile purchase bar. */
(() => {
  const T = window.theme;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function initProduct(root) {
    if (root._zyInit) return; root._zyInit = true;
    const data = JSON.parse($('[data-product-json]', root).textContent);
    const form = $('[data-product-form]', root);
    const idInput = $('[data-variant-input]', root);
    const addBtn = $('[data-add-button]', root);
    const fieldset = $('[data-size-fieldset]', root);
    const errorEl = $('[data-size-error]', root);
    const selectedEl = $('[data-selected-size]', root);
    const priceWrap = $('[data-price-wrap]', root);
    const msg = $('[data-form-msg]', root);
    const radios = $$('[data-size-input]', root);
    const hasSizes = root.dataset.hasSizes === 'true' && radios.length > 0;
    let variant = data.variants.find(v => String(v.id) === idInput.value) || null;
    const needsSize = () => hasSizes && !variant;
    const bar = $('[data-buybar]', root); const barBtn = bar && $('[data-buybar-btn]', bar); const barMeta = bar && $('[data-buybar-meta]', bar);

    // ---- variant selection ----
    function priceHTML(v) {
      const sale = v.compare && v.compare > v.price;
      const pct = sale ? Math.round((v.compare - v.price) * 100 / v.compare) : 0;
      const save = sale && priceWrap.querySelector('.price__save') !== null;
      return `<span class="price${v.available ? '' : ' price--sold-out'}" data-price><span>${T.money(v.price)}</span>${sale ? `<s>${T.money(v.compare)}</s>${save ? `<span class="price__save">−${pct}&nbsp;%</span>` : ''}` : ''}</span>`;
    }
    function select(v, { fromUser = false } = {}) {
      variant = v;
      idInput.value = v.id; idInput.setAttribute('value', v.id); // ordering apps read the attribute
      const size = data.sizeIndex != null ? v.options[data.sizeIndex] : v.options[0];
      if (selectedEl) selectedEl.innerHTML = ` : <strong>${T.escapeHTML(size)}</strong>`;
      if (priceWrap) priceWrap.innerHTML = priceHTML(v);
      addBtn.disabled = !v.available;
      addBtn.textContent = v.available ? T.strings.addToCart : T.strings.soldOut;
      hideError();
      const url = new URL(window.location.href); url.searchParams.set('variant', v.id); url.searchParams.delete('size');
      window.history.replaceState(window.history.state, '', url.toString());
      if (fromUser && hasSizes && data.sizeIndex != null) T.size.set(size);
      $$('[data-sibling-link]', root).forEach(a => { const u = new URL(a.href, window.location.origin); u.searchParams.set('size', size); a.href = u.pathname + u.search; });
      updateBuybar();
      root.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variant: v } }));
    }
    radios.forEach(r => r.addEventListener('change', () => { const v = data.variants.find(x => String(x.id) === r.value); if (v) select(v, { fromUser: true }); }));

    // carried size from another colourway (?size=42): only if that size exists and is available here
    const carried = new URLSearchParams(window.location.search).get('size');
    if (hasSizes && !variant && carried) {
      const v = data.variants.find(x => x.available && (data.sizeIndex != null ? x.options[data.sizeIndex] : x.options[0]) === carried);
      const r = v && radios.find(x => x.value === String(v.id));
      if (r) { r.checked = true; select(v); }
    }

    // remembered size: marked, never pre-selected
    function paintMine() {
      const mine = T.size.get(); const note = $('[data-size-mine]', root);
      if (!note || !hasSizes) return;
      const r = mine && radios.find(x => x.dataset.size === mine);
      if (!r) { note.hidden = true; return; }
      note.hidden = false;
      note.textContent = `${T.strings.yourSize} : ${mine}${r.disabled ? ` — ${T.strings.soldOut.toLowerCase()}` : ''}`;
    }
    paintMine(); document.addEventListener('size:change', paintMine);

    // ---- validation ----
    function showError() {
      if (!fieldset) return;
      errorEl.hidden = false; fieldset.classList.add('is-invalid');
      fieldset.classList.remove('shake'); void fieldset.offsetWidth; fieldset.classList.add('shake');
      const r = fieldset.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight) fieldset.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = radios.find(x => !x.disabled); if (first) first.focus({ preventScroll: true });
    }
    function hideError() { if (errorEl) errorEl.hidden = true; if (fieldset) fieldset.classList.remove('is-invalid'); }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (needsSize()) { showError(); return; }
      if (!variant || !variant.available) return;
      addBtn.classList.add('is-loading'); msg.hidden = true;
      try { await T.cart.add([{ id: variant.id, quantity: 1 }]); }
      catch (err) { msg.textContent = err.message; msg.className = 'pdp__form-msg small is-error'; msg.hidden = false; }
      finally { addBtn.classList.remove('is-loading'); }
    });

    // ---- ordering app guard (EasySell COD): no order without an explicit size ----
    // The app falls back to the first variant when the form has no variant id, so block its button until a size is chosen.
    const appSelector = T.appBuySelector;
    if (appSelector) {
      const guard = e => {
        const btn = e.target.closest && e.target.closest(appSelector);
        if (!btn || !needsSize()) return;
        e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
        showError();
      };
      ['click', 'pointerup', 'touchend'].forEach(t => document.addEventListener(t, guard, true));
      // the app's own sticky button replaces our mobile bar (no competing fixed buttons)
      const detect = () => { if (document.querySelector('.es-sticky')) document.documentElement.classList.add('has-app-sticky'); };
      detect(); new MutationObserver(detect).observe(document.body, { childList: true, subtree: true });
    }

    // ---- gallery: dots/counter on mobile swipe ----
    const track = $('[data-gallery-track]', root);
    const dots = $$('.pdp__dot', root); const counter = $('[data-gallery-counter]', root);
    if (track && dots.length) {
      const slides = $$('.pdp__slide', track);
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting && en.intersectionRatio > .6) { const i = slides.indexOf(en.target); dots.forEach((d, j) => d.classList.toggle('is-active', j === i)); if (counter) counter.textContent = `${i + 1} / ${slides.length}`; } });
      }, { root: track, threshold: [.6] });
      slides.forEach(s => io.observe(s));
    }

    // ---- zoom ----
    const zoom = $('[data-zoom]', root);
    if (zoom) {
      document.body.appendChild(zoom);
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-zoom-open]'); if (!b) return;
        T.openDrawer(zoom.id, b);
        const item = $$('[data-zoom-item]', zoom)[+b.dataset.zoomOpen];
        if (item) setTimeout(() => item.scrollIntoView({ block: 'start' }), 30);
      });
      $$('[data-zoom-item]', zoom).forEach(item => {
        item.addEventListener('click', e => {
          if (!window.matchMedia('(hover: hover)').matches) return; // touch: native pinch zoom
          item.classList.toggle('is-zoomed'); pan(e, item);
        });
        item.addEventListener('mousemove', e => { if (item.classList.contains('is-zoomed')) pan(e, item); });
      });
      const pan = (e, item) => { const r = item.getBoundingClientRect(); item.style.setProperty('--zx', `${((e.clientX - r.left) / r.width) * 100}%`); item.style.setProperty('--zy', `${((e.clientY - r.top) / r.height) * 100}%`); };
      zoom.addEventListener('drawer:close', () => $$('.is-zoomed', zoom).forEach(i => i.classList.remove('is-zoomed')));
    }

    // ---- mobile purchase bar ----
    function updateBuybar() {
      if (!bar) return;
      if (needsSize()) barBtn.textContent = T.strings.chooseSize;
      else barBtn.textContent = addBtn.offsetParent ? T.strings.addToCart : (variant ? T.money(variant.price) : T.strings.addToCart);
      if (variant && barMeta) barMeta.textContent = `${T.money(variant.price)}${data.sizeIndex != null ? ' · ' + variant.options[data.sizeIndex] : ''}`;
    }
    if (bar) {
      bar.hidden = false; updateBuybar();
      const watch = $('[data-buy-wrap]', root);
      root.classList.add('pdp--buybar-space');
      let raf = 0;
      const check = () => { raf = 0; bar.classList.toggle('is-visible', watch.getBoundingClientRect().bottom < 0); };
      window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
      check();
      barBtn.addEventListener('click', () => {
        if (needsSize()) { showError(); return; }
        if (addBtn.offsetParent) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
        else watch.scrollIntoView({ behavior: 'smooth', block: 'center' }); // ordering app button lives here
      });
    }
  }

  const boot = (scope = document) => $$('[data-product]', scope).forEach(initProduct);
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', () => boot());
  document.addEventListener('shopify:section:load', e => boot(e.target));
})();
