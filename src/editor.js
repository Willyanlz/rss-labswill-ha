class RssNewsCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._rendered = false;
  }

  setConfig(config) {
    const prevSourceCount = (this._config.sources || []).length;
    this._config = { ...config };
    if (!this._rendered) {
      this._renderShell();
    } else {
      this._syncFields();
      // Only re-render sources if count changed (add/remove), not on field edits
      const newSourceCount = (this._config.sources || []).length;
      if (newSourceCount !== prevSourceCount) {
        this._renderSources();
      }
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._renderShell();
  }

  _getLang() {
    try {
      const haLang = this._hass?.locale?.language || this._hass?.language || 'en';
      return haLang.split('-')[0].toLowerCase();
    } catch { return 'en'; }
  }

  _t() { return getLocale(this._getLang()); }

  _renderShell() {
    this._rendered = true;
    const c = this._config || {};
    const t = this._t();

    this.innerHTML = `
      <style>
        .rss-ed{padding:12px;}
        .rss-ed label{display:block;font-size:12px;color:var(--secondary-text-color);margin:10px 0 4px;}
        .rss-ed input[type=text],.rss-ed input[type=number]{width:100%;padding:4px 8px;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:4px;background:var(--card-background-color);color:var(--primary-text-color);}
        .rss-src-row{display:flex;gap:8px;align-items:center;margin-bottom:6px;}
        .rss-src-row input{width:auto!important;}
        .rss-add{margin-top:6px;padding:4px 12px;cursor:pointer;background:var(--primary-color);color:var(--text-primary-color);border:none;border-radius:4px;}
        .rss-del{padding:2px 8px;cursor:pointer;border:1px solid var(--divider-color);border-radius:4px;background:transparent;color:var(--primary-text-color);}
        .rss-toggle-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--divider-color);}
        .rss-toggle-row label{margin:0;font-size:13px;color:var(--primary-text-color);}
        .rss-toggle{position:relative;width:36px;height:20px;flex-shrink:0;}
        .rss-toggle input{opacity:0;width:0;height:0;}
        .rss-slider{position:absolute;cursor:pointer;inset:0;background:var(--disabled-color,#ccc);border-radius:20px;transition:.2s;}
        .rss-slider:before{content:'';position:absolute;height:14px;width:14px;left:3px;bottom:3px;background:white;border-radius:50%;transition:.2s;}
        input:checked + .rss-slider{background:var(--primary-color);}
        input:checked + .rss-slider:before{transform:translateX(16px);}
      </style>
      <div class="rss-ed"><small style="color:var(--secondary-text-color)">LabsWill Carousel • 2.1.1</small>
        <label>${t.ed.card_title}</label>
        <input type="text" id="ed-title" value="${c.title || ''}"/>

        <label>${t.ed.sources}</label>
        <div id="ed-sources"></div>
        <button class="rss-add" id="ed-add">${t.ed.add_source}</button>

        <label for="ed-interval">Intervalo entre notícias (segundos)</label>
        <input type="number" id="ed-interval" min="3" value="${c.slide_interval ?? 8}"/>
        <label for="ed-interaction">Retomar após interação (segundos)</label>
        <input type="number" id="ed-interaction" min="3" value="${c.interaction_timeout ?? 20}"/>
        <label for="ed-pause-timeout">Retomar após pausa (segundos; 0 = pausa permanente)</label>
        <input type="number" id="ed-pause-timeout" min="0" value="${c.pause_timeout ?? 60}"/>
        <label><input type="checkbox" id="ed-autoplay" ${c.autoplay !== false ? 'checked' : ''}/> Iniciar automaticamente</label>

        <label>${t.ed.max_articles}</label>
        <input type="number" id="ed-max" min="1" value="${c.max_articles || 10}"/>

        <label>${t.ed.card_height}</label>
        <input type="number" id="ed-height" min="100" max="2000" placeholder="Auto" value="${c.card_height || ''}"/>

        <label>${t.ed.img_width}</label>
        <input type="number" id="ed-imgw" min="50" max="2000" placeholder="100%" value="${c.image_width || ''}"/>

        <label for="ed-image-fit">Ajuste da imagem</label>
        <select id="ed-image-fit" style="width:100%;padding:8px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color)">
          <option value="contain" ${c.image_fit !== 'cover' ? 'selected' : ''}>Mostrar inteira (sem cortes)</option>
          <option value="cover" ${c.image_fit === 'cover' ? 'selected' : ''}>Preencher (pode cortar)</option>
        </select>
        <label>${t.ed.img_height}</label>
        <input type="number" id="ed-imgh" min="1" max="2000" placeholder="Auto (16:9)" value="${c.image_height || ''}"/>

        <label>${t.ed.title_size}</label>
        <input type="number" id="ed-titlesize" min="10" max="30" value="${c.title_font_size || 15}"/>

        <label>${t.ed.desc_size}</label>
        <input type="number" id="ed-descsize" min="10" max="24" value="${c.desc_font_size || 14}"/>

        <label>${t.ed.card_title_color} <small style="opacity:0.6;">(${t.ed.color_hint})</small></label>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="position:relative;width:32px;height:28px;flex-shrink:0;cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid var(--divider-color);">
            <div id="prev-card-title-color" style="position:absolute;inset:0;background:${c.card_title_color || 'transparent'};pointer-events:none;${!c.card_title_color ? 'background-image:repeating-linear-gradient(45deg,#ccc 0,#ccc 2px,transparent 0,transparent 50%);background-size:6px 6px;' : ''}"></div>
            <input type="color" id="ed-card-title-color" value="${c.card_title_color || '#ffffff'}" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"/>
          </label>
          <input type="text" id="ed-card-title-color-text" placeholder="e.g. #ff0000 or empty" value="${c.card_title_color || ''}"/>
        </div>

        <label>${t.ed.article_title_color} <small style="opacity:0.6;">(${t.ed.color_hint})</small></label>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="position:relative;width:32px;height:28px;flex-shrink:0;cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid var(--divider-color);">
            <div id="prev-article-title-color" style="position:absolute;inset:0;background:${c.article_title_color || 'transparent'};pointer-events:none;${!c.article_title_color ? 'background-image:repeating-linear-gradient(45deg,#ccc 0,#ccc 2px,transparent 0,transparent 50%);background-size:6px 6px;' : ''}"></div>
            <input type="color" id="ed-article-title-color" value="${c.article_title_color || '#ffffff'}" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"/>
          </label>
          <input type="text" id="ed-article-title-color-text" placeholder="e.g. #ff0000 or empty" value="${c.article_title_color || ''}"/>
        </div>

        <label>${t.ed.desc_color} <small style="opacity:0.6;">(${t.ed.color_hint})</small></label>
        <div style="display:flex;gap:8px;align-items:center;">
          <label style="position:relative;width:32px;height:28px;flex-shrink:0;cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid var(--divider-color);">
            <div id="prev-desc-color" style="position:absolute;inset:0;background:${c.desc_color || 'transparent'};pointer-events:none;${!c.desc_color ? 'background-image:repeating-linear-gradient(45deg,#ccc 0,#ccc 2px,transparent 0,transparent 50%);background-size:6px 6px;' : ''}"></div>
            <input type="color" id="ed-desc-color" value="${c.desc_color || '#ffffff'}" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"/>
          </label>
          <input type="text" id="ed-desc-color-text" placeholder="e.g. #ff0000 or empty" value="${c.desc_color || ''}"/>
        </div>

        <div style="margin-top:12px;">
          <div class="rss-toggle-row">
            <label for="tog-source">${t.ed.show_source}</label>
            <label class="rss-toggle">
              <input type="checkbox" id="tog-source" ${c.show_source !== false ? 'checked' : ''}/>
              <span class="rss-slider"></span>
            </label>
          </div>
          <div class="rss-toggle-row">
            <label for="tog-date">${t.ed.show_date}</label>
            <label class="rss-toggle">
              <input type="checkbox" id="tog-date" ${c.show_date !== false ? 'checked' : ''}/>
              <span class="rss-slider"></span>
            </label>
          </div>
          <div class="rss-toggle-row">
            <label for="tog-desc">${t.ed.show_desc}</label>
            <label class="rss-toggle">
              <input type="checkbox" id="tog-desc" ${c.show_description !== false ? 'checked' : ''}/>
              <span class="rss-slider"></span>
            </label>
          </div>
        </div>
      </div>`;

    this._renderSources();
    this._attachListeners();
    // Sync color previews after DOM is ready
    requestAnimationFrame(() => this._syncColorPreviews());
  }

  _syncColorPreviews() {
    // Find the card element via DOM traversal from the editor
    const card = this.closest('ha-card') || document.querySelector('rss-news-card');
    const syncPreview = (previewId, configVal, cssVar) => {
      const preview = this.querySelector(previewId);
      if (!preview) return;
      if (configVal) {
        // Config has a value – use it directly
        preview.style.backgroundImage = 'none';
        preview.style.background = configVal;
      } else {
        // No config value – read computed color from the card element
        if (card) {
          const computed = getComputedStyle(card).getPropertyValue(cssVar).trim();
          if (computed) {
            preview.style.backgroundImage = 'none';
            preview.style.background = computed;
            return;
          }
        }
        // Fallback: show transparent pattern
        preview.style.background = 'transparent';
        preview.style.backgroundImage = 'repeating-linear-gradient(45deg,#ccc 0,#ccc 2px,transparent 0,transparent 50%)';
        preview.style.backgroundSize = '6px 6px';
      }
    };
    const c = this._config || {};
    syncPreview('#prev-card-title-color',    c.card_title_color,    '--primary-text-color');
    syncPreview('#prev-article-title-color', c.article_title_color, '--primary-text-color');
    syncPreview('#prev-desc-color',          c.desc_color,          '--secondary-text-color');
  }

  _renderSources() {
    const container = this.querySelector('#ed-sources');
    if (!container) return;
    const sources = this._config.sources || [];
    container.innerHTML = sources.map((s, i) => `
      <div class="rss-src-row" data-idx="${i}">
        <input type="text" style="flex:1;min-width:0;" placeholder="sensor.telex_rss" data-field="entity" value="${s.entity || ''}"/>
        <input type="text" style="width:80px;flex-shrink:0;" placeholder="Name" data-field="name" value="${s.name || ''}"/>
        <label style="position:relative;width:32px;height:28px;flex-shrink:0;cursor:pointer;border-radius:4px;overflow:hidden;border:1px solid var(--divider-color);">
          <div style="position:absolute;inset:0;background:${s.color || '#0077cc'};pointer-events:none;" class="rss-color-preview-${i}"></div>
          <input type="color" data-field="color" value="${s.color || '#0077cc'}" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"/>
        </label>
        <button class="rss-del" data-idx="${i}">✕</button>
      </div>`).join('');

    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const row = input.closest('.rss-src-row');
        const idx = parseInt(row.dataset.idx);
        const field = input.dataset.field;
        const sources = [...(this._config.sources || [])];
        sources[idx] = { ...sources[idx], [field]: input.value };
        this._upd('sources', sources);
        // Update color preview div live
        if (field === 'color') {
          const preview = row.querySelector('.rss-color-preview-' + idx);
          if (preview) preview.style.background = input.value;
        }
      });
    });

    container.querySelectorAll('.rss-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const sources = (this._config.sources || []).filter((_, i) => i !== idx);
        this._upd('sources', sources);
        this._renderSources();
      });
    });
  }

  _attachListeners() {
    const bind = (id, key, transform) => {
      const el = this.querySelector(id);
      if (!el) return;
      el.addEventListener('input', e => this._upd(key, transform ? transform(e.target.value) : e.target.value));
    };
    const bindChk = (id, key) => {
      const el = this.querySelector(id);
      if (!el) return;
      el.addEventListener('change', e => this._upd(key, e.target.checked));
    };

    this.querySelector('#ed-image-fit').addEventListener('change', e => this._upd('image_fit', e.target.value));
    bind('#ed-title',    'title');
    bind('#ed-interval', 'slide_interval', v => Number(v));
    bind('#ed-interaction', 'interaction_timeout', v => Number(v));
    bind('#ed-pause-timeout', 'pause_timeout', v => Number(v));
    bindChk('#ed-autoplay', 'autoplay');
    bind('#ed-max',      'max_articles',    v => parseInt(v) || 10);
    bind('#ed-height',   'card_height',     v => parseInt(v) || undefined);
    bind('#ed-imgw',     'image_width',     v => parseInt(v) || undefined);
    bind('#ed-imgh',     'image_height',    v => parseInt(v) || undefined);
    bind('#ed-titlesize','title_font_size', v => parseInt(v) || 15);
    bind('#ed-descsize', 'desc_font_size',  v => parseInt(v) || 14);
    bind('#ed-card-title-color-text',    'card_title_color');
    bind('#ed-article-title-color-text', 'article_title_color');
    bind('#ed-desc-color-text',          'desc_color');

    // Color picker → text field + preview sync
    const bindColorPicker = (pickerId, textId, previewId, key) => {
      const picker = this.querySelector(pickerId);
      const text   = this.querySelector(textId);
      const preview = this.querySelector(previewId);
      if (!picker) return;
      picker.addEventListener('input', e => {
        const val = e.target.value;
        if (text) text.value = val;
        if (preview) preview.style.background = val;
        this._upd(key, val);
      });
      // Text field → preview sync
      if (text) {
        text.addEventListener('input', e => {
          const val = e.target.value;
          if (preview && (val === '' || /^#[0-9a-fA-F]{3,6}$/.test(val))) {
            preview.style.background = val || '#ffffff';
            if (picker) picker.value = val || '#ffffff';
          }
        });
      }
    };
    bindColorPicker('#ed-card-title-color',    '#ed-card-title-color-text',    '#prev-card-title-color',    'card_title_color');
    bindColorPicker('#ed-article-title-color', '#ed-article-title-color-text', '#prev-article-title-color', 'article_title_color');
    bindColorPicker('#ed-desc-color',          '#ed-desc-color-text',          '#prev-desc-color',          'desc_color');

    bindChk('#tog-source', 'show_source');
    bindChk('#tog-date',   'show_date');
    bindChk('#tog-desc',   'show_description');

    const addBtn = this.querySelector('#ed-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const sources = [...(this._config.sources || []), { entity: '', name: '', color: '#0077cc' }];
        this._upd('sources', sources);
        this._renderSources();
      });
    }
  }

  _syncFields() {
    const c = this._config;
    const set = (id, val) => { const el = this.querySelector(id); if (el && document.activeElement !== el) el.value = val ?? ''; };
    const setChk = (id, val) => { const el = this.querySelector(id); if (el) el.checked = !!val; };
    set('#ed-image-fit', c.image_fit === 'cover' ? 'cover' : 'contain');
    set('#ed-title',     c.title);
    set('#ed-interval', c.slide_interval ?? 8);
    set('#ed-interaction', c.interaction_timeout ?? 20);
    set('#ed-pause-timeout', c.pause_timeout ?? 60);
    setChk('#ed-autoplay', c.autoplay !== false);
    set('#ed-max',       c.max_articles);
    set('#ed-height',    c.card_height);
    set('#ed-imgw',      c.image_width);
    set('#ed-imgh',      c.image_height);
    set('#ed-titlesize', c.title_font_size);
    set('#ed-descsize',  c.desc_font_size);
    set('#ed-card-title-color-text',    c.card_title_color);
    set('#ed-article-title-color-text', c.article_title_color);
    set('#ed-desc-color-text',          c.desc_color);
    setChk('#tog-source', c.show_source !== false);
    setChk('#tog-date',   c.show_date !== false);
    setChk('#tog-desc',   c.show_description !== false);
  }

  _upd(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent('config-changed', { bubbles: true, composed: true, detail: { config: this._config } }));
  }
}

customElements.define('rss-news-card', RssNewsCard);
customElements.define('rss-news-card-editor', RssNewsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'rss-news-card',
  name: 'RSS News Card',
  description: 'LabsWill Carousel 2.1.1 • RSS com dimensoes configuraveis.',
  preview: true,
});
