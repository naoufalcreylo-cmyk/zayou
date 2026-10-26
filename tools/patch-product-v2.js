// v2: product page links to the guide pages, delivery & material-aware care accordions (kept for traceability)
const fs = require('fs'); const path = require('path');
const f = path.join(__dirname, '../theme/sections/main-product.liquid'); let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('not found: ' + a.slice(0, 70)); s = s.replace(a, b); };

rep(`<button type="button" class="link small" data-drawer-open="size-guide" aria-controls="size-guide">{% render 'icon', name: 'ruler', class: 'icon--sm' %} {{ 'products.product.size_guide' | t }}</button>`,
  `<a class="link small" href="{{ settings.size_guide_page.url }}">{% render 'icon', name: 'ruler', class: 'icon--sm' %} {{ 'products.product.size_guide' | t }}</a>`);

const a = s.indexOf(`          {%- if settings.delivery_page != blank -%}`);
const b = s.indexOf(`        </div>\n      </div>\n    </div>\n  </div>`, a);
if (a < 0 || b < 0) throw new Error('accordion block not found');
s = s.slice(0, a) + `          {%- if settings.pdp_delivery_text != blank or settings.delivery_page != blank -%}
            <details class="acc">
              <summary class="acc__title">{{ 'products.product.delivery' | t }}{% render 'icon', name: 'plus', class: 'icon--sm' %}</summary>
              <div class="acc__body rte">
                {{ settings.pdp_delivery_text }}
                {%- if settings.delivery_page != blank -%}{{ settings.delivery_page.content }}{%- endif -%}
                {%- if settings.faq_page != blank -%}<p><a href="{{ settings.faq_page.url }}">{{ 'products.product.faq_link' | t }}</a></p>{%- endif -%}
              </div>
            </details>
          {%- endif -%}
          {%- if size_index != null and settings.care_page != blank or size_index != null and settings.care_article != blank -%}
            {%- liquid
              assign mat = way_material | append: ' ' | append: product.title | downcase
              assign care_key = 'products.care.general'
              if mat contains 'daim' or mat contains 'nubuck'
                assign care_key = 'products.care.suede'
              elsif mat contains 'cuir'
                assign care_key = 'products.care.leather'
              endif
              assign care_url = settings.care_page.url | default: settings.care_article.url
            -%}
            <details class="acc">
              <summary class="acc__title">{{ 'products.product.care' | t }}{% render 'icon', name: 'plus', class: 'icon--sm' %}</summary>
              <div class="acc__body rte">
                <p>{{ care_key | t }}</p>
                <p><a href="{{ care_url }}">{{ 'products.product.care_link' | t }}</a></p>
              </div>
            </details>
          {%- endif -%}
          {%- if settings.style_page != blank and size_index != null -%}
            <a class="pdp__guide-link" href="{{ settings.style_page.url }}">
              <span>{{ 'products.product.style_link' | t }}</span>{% render 'icon', name: 'arrow-right', class: 'icon--sm' %}
            </a>
          {%- endif -%}
` + s.slice(b);

const c = s.indexOf(`  {%- if settings.size_guide_page != blank -%}\n    <div class="drawer drawer--right" id="size-guide"`);
const d = s.indexOf(`  {%- endif -%}`, c) + `  {%- endif -%}`.length;
if (c < 0) throw new Error('size guide drawer not found');
s = s.slice(0, c) + s.slice(d);
fs.writeFileSync(f, s); console.log('main-product patched');
