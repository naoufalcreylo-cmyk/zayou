// v2: collection intro, category chips, editorial tiles inside the grid (kept for traceability)
const fs = require('fs'); const path = require('path');
const f = path.join(__dirname, '../theme/sections/main-collection.liquid'); let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('not found: ' + a.slice(0, 70)); s = s.replace(a, b); };

rep(`{%- liquid
  assign per_page = section.settings.per_page
-%}`, `{%- liquid
  assign per_page = section.settings.per_page
  assign intro = null
  for block in section.blocks
    if block.type == 'intro' and block.settings.collection.handle == collection.handle
      assign intro = block
    endif
  endfor
  assign intro_img = null
  if intro
    assign intro_img = intro.settings.image
    if intro_img == blank and intro.settings.product != blank
      assign iidx = intro.settings.image_position | minus: 1
      assign intro_img = intro.settings.product.media[iidx].preview_image | default: intro.settings.product.featured_image
    endif
  endif
-%}`);

rep(`    <header class="collection__head">
      <h1 class="h1 lower">{{ collection.title }}</h1>
      <p class="muted collection__count">{{ 'collections.products_count' | t: count: collection.all_products_count }}</p>
    </header>
  </div>`, `    <header class="collection__head{% if intro_img %} collection__head--image{% endif %}">
      <div class="collection__head-text">
        <h1 class="h1 lower">{{ intro.settings.title | default: collection.title }} <span class="muted collection__count">{{ 'collections.products_count' | t: count: collection.all_products_count }}</span></h1>
        {%- if intro and intro.settings.text != blank -%}<div class="collection__intro">{{ intro.settings.text }}</div>{%- endif -%}
      </div>
      {%- if intro_img -%}
        <div class="collection__head-media media media--tile media--photo" {{ intro.shopify_attributes }}>
          {{ intro_img | image_url: width: 600 | image_tag: loading: 'eager', widths: '300, 450, 600', sizes: '220px', alt: intro.settings.image_alt }}
        </div>
      {%- endif -%}
    </header>
    {%- if section.settings.nav_menu.links.size > 0 -%}
      <nav class="collection__nav" aria-label="{{ 'collections.categories' | t }}">
        {%- for link in section.settings.nav_menu.links -%}
          {%- unless link.type == 'frontpage_link' or link.type == 'collection_link' and link.object.products_count == 0 -%}
            <a class="chip-link{% if link.current or link.object.handle == collection.handle %} is-active{% endif %}" href="{{ link.url }}"{% if link.current or link.object.handle == collection.handle %} aria-current="page"{% endif %}>{{ link.title }}</a>
          {%- endunless -%}
        {%- endfor -%}
      </nav>
    {%- endif -%}
  </div>`);

rep(`              <li>{% render 'product-card', product: product, loading: loading %}</li>`, `              <li>{% render 'product-card', product: product, loading: loading %}</li>
              {%- if paginate.current_page == 1 -%}
                {%- for block in section.blocks -%}
                  {%- if block.type == 'insert' and block.settings.position == forloop.parentloop.index -%}
                    {%- if block.settings.collection == blank or block.settings.collection.handle == collection.handle -%}
                      {%- liquid
                        assign t_img = block.settings.image
                        if t_img == blank and block.settings.product != blank
                          assign tidx = block.settings.image_position | minus: 1
                          assign t_img = block.settings.product.media[tidx].preview_image | default: block.settings.product.featured_image
                        endif
                      -%}
                      <li class="grid-insert" {{ block.shopify_attributes }}>
                        <a class="grid-insert__link" href="{{ block.settings.link }}">
                          <span class="media media--tile media--photo">
                            {%- if t_img -%}{{ t_img | image_url: width: 800 | image_tag: loading: 'lazy', widths: '360, 540, 800', sizes: '(min-width: 1200px) 23vw, (min-width: 750px) 31vw, 46vw', alt: block.settings.image_alt }}{%- endif -%}
                          </span>
                          <span class="grid-insert__text">
                            {%- if block.settings.eyebrow != blank -%}<span class="eyebrow muted">{{ block.settings.eyebrow }}</span>{%- endif -%}
                            <span class="grid-insert__title">{{ block.settings.title }}</span>
                            {%- if block.settings.link_label != blank -%}<span class="link-arrow small">{{ block.settings.link_label }}{% render 'icon', name: 'arrow-right', class: 'icon--sm' %}</span>{%- endif -%}
                          </span>
                        </a>
                      </li>
                    {%- endif -%}
                  {%- endif -%}
                {%- endfor -%}
              {%- endif -%}`);

rep(`    { "type": "checkbox", "id": "show_description", "label": "Afficher la description sous la grille", "default": true }
  ]`, `    { "type": "checkbox", "id": "show_description", "label": "Afficher la description sous la grille", "default": true },
    { "type": "link_list", "id": "nav_menu", "label": "Raccourcis de catégories", "default": "main-menu" }
  ],
  "blocks": [
    { "type": "intro", "name": "Introduction de collection", "settings": [
      { "type": "collection", "id": "collection", "label": "Collection" },
      { "type": "text", "id": "title", "label": "Titre (par défaut : titre de la collection)" },
      { "type": "richtext", "id": "text", "label": "Introduction (une ou deux phrases)" },
      { "type": "image_picker", "id": "image", "label": "Image" },
      { "type": "product", "id": "product", "label": "Ou : photo d'un produit" },
      { "type": "range", "id": "image_position", "label": "Numéro de la photo", "min": 1, "max": 10, "step": 1, "default": 1 },
      { "type": "text", "id": "image_alt", "label": "Texte alternatif" }
    ] },
    { "type": "insert", "name": "Vignette éditoriale", "settings": [
      { "type": "collection", "id": "collection", "label": "Collection (vide = toutes)" },
      { "type": "range", "id": "position", "label": "Après le produit n°", "min": 2, "max": 24, "step": 1, "default": 7 },
      { "type": "image_picker", "id": "image", "label": "Image" },
      { "type": "product", "id": "product", "label": "Ou : photo d'un produit" },
      { "type": "range", "id": "image_position", "label": "Numéro de la photo", "min": 1, "max": 10, "step": 1, "default": 1 },
      { "type": "text", "id": "image_alt", "label": "Texte alternatif" },
      { "type": "text", "id": "eyebrow", "label": "Surtitre", "default": "Inspirations" },
      { "type": "text", "id": "title", "label": "Titre", "default": "Comment le porter" },
      { "type": "text", "id": "link_label", "label": "Texte du lien", "default": "Lire" },
      { "type": "url", "id": "link", "label": "Lien" }
    ] }
  ]`);
fs.writeFileSync(f, s); console.log('main-collection patched');
