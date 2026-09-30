class RssNewsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.addEventListener('focusin', () => {
      if (this._config && !this._movingFocus) this._interact();
    });
    this.shadowRoot.addEventListener('focusout', () => queueMicrotask(() => {
      if (this.isConnected && this._config && !this.shadowRoot.activeElement) this._interact();
    }));
    this._articles = [];
    this._index = 0;
    this._visible = true;
    this._paused = false;
    this._resumeAt = 0;
    this.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { this._hover = true; this._schedule(); }
    });
    this.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') { this._hover = false; if (this._config) this._interact(); }
    });
    this.addEventListener('pointerdown', event => { this._touchFocus = event.pointerType === 'touch'; }, {capture:true});
    this.addEventListener('keydown', () => { this._touchFocus = false; this._schedule(); }, {capture:true});
    this._visibility = () => this._schedule(true);
    // DOM replacement can suppress pointerleave; observe the next real mouse move too.
    this._pointerOutside = event => {
      if (event.pointerType === 'mouse' && this._hover && !event.composedPath().includes(this)) {
        this._hover = false;
        if (this._config) this._interact();
      }
    };
    // Swipe Navigation listens on ancestor elements: keep card gestures local.
    for (const name of ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove','pointerup','pointercancel','mousedown','mousemove','mouseup']) {
      this.addEventListener(name, event => event.stopPropagation(), {passive:true});
    }
  }
  static getConfigElement() { return document.createElement('rss-news-card-editor'); }
  static getStubConfig() { return {sources: [], max_articles: 20, slide_interval: 8}; }
  setConfig(config) {
    if (!Array.isArray(config.sources) || !config.sources.length) throw new Error('Configure ao menos uma fonte RSS.');
    this._config = {...config, max_articles: Math.max(1, Math.floor(Number(config.max_articles) || 20)),
      slide_interval: this._seconds(config.slide_interval, 8, 3),
      interaction_timeout: this._seconds(config.interaction_timeout, 20, 3),
      pause_timeout: this._seconds(config.pause_timeout, 60, 0)};
    this._paused = config.autoplay === false;
    this._resumeAt = 0;
    this._nextAt = 0;
    this._signature = null;
    if (this._hass) this.hass = this._hass;
    else this._render();
  }
  _seconds(value, fallback, minimum) {
    const number = Number(value);
    return value == null || !Number.isFinite(number) ? fallback : Math.min(86400, Math.max(minimum, number));
  }
  connectedCallback() {
    document.addEventListener('pointermove', this._pointerOutside, {capture:true, passive:true});
    document.addEventListener('visibilitychange', this._visibility);
    this._observer = new IntersectionObserver(entries => {
      this._visible = entries[0].isIntersecting;
      this._schedule(true);
    });
    this._observer.observe(this);
    this._schedule();
  }
  disconnectedCallback() {
    document.removeEventListener('pointermove', this._pointerOutside, true);
    this._hover = false;
    
    this._dialog?.close();
    this._dialog?.remove();
    this._dialog = null;
    clearTimeout(this._timer);
    clearTimeout(this._readerTimer);
    this._nextAt = 0;
    this._touch = null;
    this._observer?.disconnect();
    document.removeEventListener('visibilitychange', this._visibility);
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (this._dialog?.open) return;
    const oldLink = this._articles[this._index]?.link;
    const seen = new Set();
    const pools = this._config.sources.map(source => {
      const raw = hass.states[source.entity]?.attributes?.articles;
      return (Array.isArray(raw) ? raw : []).filter(a => a && typeof a === 'object').map(a => ({...a, source: source.name || source.entity, sourceColor: source.color}))
        .sort((a,b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
        .filter(a => {
          const key = a.link || a.title;
          if (!key || seen.has(key)) return false;
          seen.add(key); return true;
        });
    });
    const selected = [];
    // Round-robin fills ten slots per source when both have enough articles.
    while (selected.length < this._config.max_articles && pools.some(p => p.length)) {
      for (const pool of pools) {
        if (pool.length && selected.length < this._config.max_articles) selected.push(pool.shift());
      }
    }
    const signature = JSON.stringify([selected, hass.locale?.language || hass.language]);
    if (signature === this._signature) return;
    this._signature = signature;
    this._articles = selected;
    this._index = Math.max(0, selected.findIndex(a => a.link === oldLink));
    this._render();
  }
  _safeUrl(value) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; }
    catch { return ''; }
  }
  _date(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const locale = this._hass?.locale?.language || this._hass?.language || 'pt-BR';
    return date.toLocaleDateString(locale) + ' • ' + date.toLocaleTimeString(locale, {hour:'2-digit',minute:'2-digit'});
  }
  _render() {
    if (!this._config) return;
    const focused = this.shadowRoot.activeElement;
    const focusClass = focused?.classList[0];
    const focusInArticle = !!focused?.closest('article');
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;min-width:0}
        [hidden]{display:none!important}
        ha-card{box-sizing:border-box;display:flex;flex-direction:column;height:var(--rss-card-height,auto);overflow:hidden;color:var(--primary-text-color);background:var(--ha-card-background,var(--card-background-color));padding:16px}
        h2{flex-shrink:0;color:var(--rss-card-title-color,var(--primary-text-color));font-size:var(--ha-card-header-font-size,24px);margin:0 0 12px}
        .viewport{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;touch-action:pan-y;outline-offset:-3px}
        .track{display:flex;transition:transform .45s ease;align-items:stretch}
        article{flex:0 0 100%;min-width:0;box-sizing:border-box;display:flex;flex-direction:column}
        .picture{position:relative;flex-shrink:0;width:var(--rss-image-width,100%);max-width:100%;height:var(--rss-image-height,auto);align-self:center;aspect-ratio:16/9;background:var(--secondary-background-color);border-radius:var(--ha-card-border-radius,12px);overflow:hidden;display:grid;place-items:center}
        .picture img{position:absolute;inset:0;display:block;min-width:0;min-height:0;width:100%;height:100%;object-fit:var(--rss-image-fit,contain);grid-area:1/1}
        .placeholder{color:var(--secondary-text-color);grid-area:1/1}
        .source{color:var(--rss-source-color,var(--secondary-text-color));font-size:14px;margin:18px 0 10px}
        .source::before{content:'●';color:var(--rss-source-color,var(--primary-color));margin-right:8px}
        .headline{color:var(--rss-article-title-color,var(--primary-text-color));text-decoration:none;font-weight:600;font-size:var(--rss-title-size,20px);line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:4.2em}
        .headline:focus-visible,button:focus-visible{outline:2px solid var(--primary-color)}
        time{display:block;color:var(--secondary-text-color);font-size:13px;margin-top:14px}
        .description{color:var(--rss-desc-color,var(--secondary-text-color));font-size:var(--rss-desc-size,14px);line-height:1.5}
        .navigation{flex-shrink:0;display:flex;justify-content:center;align-items:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--divider-color)}
        .navigation button{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;padding:0;border-radius:14px;border:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);transition:background .18s,transform .18s;touch-action:manipulation}
        .navigation button:hover{background:var(--divider-color)}
        .navigation button:active{transform:scale(.94)}
        .navigation button:focus-visible{outline:3px solid var(--primary-color);outline-offset:3px}
        .navigation .pause{background:var(--primary-color);color:var(--text-primary-color,#fff);border-color:transparent}
        .navigation svg{width:22px;height:22px;fill:currentColor;pointer-events:none}
        @media(max-width:360px){.navigation{gap:6px}}
        .counter{min-width:64px;text-align:center;font-variant-numeric:tabular-nums;color:var(--secondary-text-color);white-space:nowrap}
        .headline{text-align:left;border-radius:0;padding:0;cursor:pointer}
        .picture{cursor:pointer}
        dialog{box-sizing:border-box;width:min(1200px,calc(100vw - 32px));max-height:calc(100dvh - 16px);padding:0;border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);background:var(--card-background-color);color:var(--primary-text-color);overflow:auto;overscroll-behavior:contain}
        dialog::backdrop{background:var(--ha-dialog-scrim-color,rgba(0,0,0,.6))}
        .modal-header{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--card-background-color);border-bottom:1px solid var(--divider-color)}
        .modal-close{order:2;flex:0 0 auto;min-height:44px;margin-left:auto;padding:8px 16px;color:var(--primary-color);font-weight:600}
        .modal-body{padding:12px;overflow-wrap:anywhere}
        .article-frame{display:block;width:100%;height:min(88dvh,1100px);border:1px solid var(--divider-color);background:var(--card-background-color)}
        .reader-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}
        .modal-header .reader-tools{flex:1;min-width:0;margin:0 8px}
        .reader-status{font-size:12px;color:var(--secondary-text-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .reader-tools button{min-height:44px;padding:8px 12px;border:1px solid var(--divider-color);color:var(--primary-color)}
        .qr-panel{text-align:center;padding:16px 0}
        .qr-panel canvas{display:block;width:min(256px,100%);height:auto;image-rendering:pixelated;margin:16px auto;background:white}
        .qr-url{overflow-wrap:anywhere;color:var(--secondary-text-color);font-size:12px}
        button{border:0;background:transparent;color:var(--secondary-text-color);cursor:pointer;min-width:28px;min-height:32px;padding:4px;font:inherit;border-radius:6px}
        .dot{min-width:16px;width:16px;padding:3px}
        .dot::before{content:'';display:block;width:6px;height:6px;border:1px solid var(--secondary-text-color);border-radius:50%}
        .dot[aria-current=true]::before{background:var(--primary-color);border-color:var(--primary-color)}
        .empty{padding:30px 0;color:var(--secondary-text-color);text-align:center}
        @media(prefers-reduced-motion:reduce){.track{transition:none}}
      </style>
      <ha-card><h2 hidden></h2><div class="viewport" tabindex="0" role="region" aria-label="Notícias em carrossel"><div class="track"></div></div><div class="navigation"><button class="previous" title="Notícia anterior" aria-label="Notícia anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 5.3-1.4-1.4L5.2 12l8.1 8.1 1.4-1.4L8 12z"/></svg></button><span class="counter" aria-label="Posição da notícia"></span><button class="next" title="Próxima notícia" aria-label="Próxima notícia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.3 5.3 1.4-1.4 8.1 8.1-8.1 8.1-1.4-1.4L16 12z"/></svg></button><button class="pause" aria-label="Pausar notícias">Ⅱ</button></div></ha-card>`;
    const root = this.shadowRoot;
    const title = root.querySelector('h2');
    title.textContent = this._config.title || ''; title.hidden = !this._config.title;
    this.style.setProperty('--rss-title-size', `${Math.max(14, Number(this._config.title_font_size) || 20)}px`);
    for (const [key, variable] of Object.entries({card_height:'--rss-card-height',image_width:'--rss-image-width',image_height:'--rss-image-height',desc_font_size:'--rss-desc-size'})) {
      const value = Number(this._config[key]);
      if (Number.isFinite(value) && value > 0) this.style.setProperty(variable, `${value}px`);
      else this.style.removeProperty(variable);
    }
    for (const [key, variable] of Object.entries({card_title_color:'--rss-card-title-color',article_title_color:'--rss-article-title-color',desc_color:'--rss-desc-color'})) {
      const value = this._config[key];
      if (value && CSS.supports('color', value)) this.style.setProperty(variable,value);
      else this.style.removeProperty(variable);
    }
    this.style.setProperty('--rss-image-fit', this._config.image_fit === 'cover' ? 'cover' : 'contain');
    const track = root.querySelector('.track');
    this._articles.forEach((a,i) => {
      const slide = document.createElement('article');
      if (a.sourceColor && CSS.supports('color',a.sourceColor)) slide.style.setProperty('--rss-source-color',a.sourceColor);
      slide.setAttribute('aria-label', `${i+1} de ${this._articles.length}`);
      slide.innerHTML = '<div class="picture" role="button" tabindex="0" aria-label="Abrir resumo da notícia"><span class="placeholder">Imagem indisponível</span></div><div class="source"></div><button class="headline" type="button"></button><time></time>';
      const url = this._safeUrl(a.image);
      if (url) {
        const img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = i === this._index ? 'eager' : 'lazy';
        img.onload = () => { slide.querySelector('.placeholder').hidden = true; };
        img.onerror = () => img.remove();
        slide.querySelector('.picture').append(img);
      }
      const source = slide.querySelector('.source'); source.textContent = a.source; source.hidden = this._config.show_source === false;
      const link = slide.querySelector('.headline'); link.textContent = a.title || 'Sem título';
      const open = () => { if (!(Date.now() < this._suppressClick)) this._openArticle(a); };
      link.onclick = open;
      const picture = slide.querySelector('.picture'); picture.onclick = open;
      picture.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
      const time = slide.querySelector('time'); time.textContent = this._date(a.pubDate); time.hidden = this._config.show_date === false;
      if (this._config.show_description === true && a.description) {
        const p = document.createElement('p'); p.className = 'description'; p.textContent = a.description; slide.append(p);
      }
      track.append(slide);
    });
    if (!this._articles.length) { track.innerHTML = '<p class="empty">Nenhuma notícia disponível. Verifique os sensores RSS.</p>'; }
    root.querySelector('.navigation').hidden = this._articles.length < 2;
    // Explicit display rule because the flex stylesheet takes precedence over hidden.
    if (this._articles.length < 2) root.querySelector('.navigation').style.display = 'none';
    root.querySelector('.previous').onclick = () => this._go(this._index - 1);
    root.querySelector('.next').onclick = () => this._go(this._index + 1);
    root.querySelector('.pause').onclick = () => {
      this._paused = !this._paused;
      this._resumeAt = this._paused && this._config.autoplay !== false && this._config.pause_timeout > 0
        ? Date.now() + this._config.pause_timeout * 1000 : 0;
      this._idleUntil = 0;
      this._schedule(true);
    };
    const viewport = root.querySelector('.viewport');
    viewport.onkeydown = e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); this._go(this._index + (e.key === 'ArrowRight' ? 1 : -1)); }
    };
    viewport.addEventListener('touchstart', e => {this._touch = [e.touches[0].clientX,e.touches[0].clientY];this._interact();}, {passive:true});
    viewport.addEventListener('touchmove', e => {
      if (!this._touch || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this._touch[0];
      const dy = e.touches[0].clientY - this._touch[1];
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) && e.cancelable) e.preventDefault();
    }, {passive:false});
    viewport.addEventListener('touchend', e => {
      if (!this._touch) return;
      const dx = e.changedTouches[0].clientX-this._touch[0], dy = e.changedTouches[0].clientY-this._touch[1];
      this._touch = null;
      if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)) {this._suppressClick = Date.now()+400;this._go(this._index+(dx<0?1:-1));}
      else this._interact();
    }, {passive:true});
    viewport.addEventListener('touchcancel', () => { this._touch = null; this._interact(); }, {passive:true});
    viewport.onclick = e => {if (Date.now()<this._suppressClick) {e.preventDefault();e.stopPropagation();}};
    const card = root.querySelector('ha-card');
    card.onpointermove = () => this._interact();
    card.onpointerdown = () => this._interact();
    card.onkeydown = () => this._interact();
    if (focusClass) {
      const scope = focusInArticle ? root.querySelectorAll('article')[this._index] : root;
      scope?.querySelector(`.${CSS.escape(focusClass)}`)?.focus({preventScroll:true});
    }
    this._sync(); this._schedule();
  }
  _sync() {
    this.shadowRoot.querySelector('.track').style.transform = `translateX(-${this._index*100}%)`;
    this.shadowRoot.querySelectorAll('article').forEach((s,i) => {s.inert=i!==this._index;s.setAttribute('aria-hidden',String(i!==this._index));});
    this.shadowRoot.querySelector('.counter').textContent = `${this._articles.length ? this._index+1 : 0} / ${this._articles.length}`;
    const pause = this.shadowRoot.querySelector('.pause');
    pause.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${this._paused ? 'M8 5v14l11-7z' : 'M6 5h4v14H6zm8 0h4v14h-4z'}"/></svg>`;
    const label = this._paused ? 'Retomar notícias' : 'Pausar notícias';
    pause.setAttribute('aria-label', label);
    pause.title = label;
    pause.setAttribute('aria-pressed', String(this._paused));

  }
  _interact() {
    this._idleUntil = Date.now() + this._config.interaction_timeout * 1000;
    if (this._paused && this._resumeAt) this._resumeAt = Date.now() + this._config.pause_timeout * 1000;
    this._schedule();
  }
  _go(index, automatic = false) {
    if (!this._articles.length) return;
    // Keep keyboard focus on a stable region before the old slide becomes inert.
    if (this.shadowRoot.activeElement?.closest('article')) {
      this._movingFocus = true;
      this.shadowRoot.querySelector('.viewport').focus({preventScroll:true});
      this._movingFocus = false;
    }
    this._index = (index + this._articles.length) % this._articles.length;
    this._nextAt = 0;
    if (!automatic) this._interact();
    else this._schedule();
  }
  _schedule(reset = false) {
    clearTimeout(this._timer);
    this._timer = null;
    const now = Date.now();
    if (reset) this._nextAt = 0;
    if (this._paused && this._resumeAt && now >= this._resumeAt) {
      this._paused = false;
      this._resumeAt = 0;
      this._idleUntil = 0;
    }
    if (this.shadowRoot.querySelector('.track')) this._sync();
    const focused = !!this.shadowRoot.activeElement && !this._touchFocus;
    if (!this.isConnected || !this._visible || document.hidden || this._dialog?.open || this._touch || this._hover || focused || this._articles.length < 2) {
      this._nextAt = 0;
      return;
    }
    if (this._paused) {
      this._nextAt = 0;
      if (this._resumeAt) this._timer = setTimeout(() => this._schedule(true), Math.max(0, this._resumeAt - now));
      return;
    }
    // Preserve the deadline across sensor refreshes and repeated observer callbacks.
    if (!this._nextAt) this._nextAt = now + this._config.slide_interval * 1000;
    const due = Math.max(this._nextAt, this._idleUntil || 0);
    this._timer = setTimeout(() => { this._nextAt = 0; this._go(this._index + 1, true); }, Math.max(0, due - now));
  }
  getCardSize() {return 7;}
  _openArticle(article) {
    if (this._dialog?.open) return;
    const focusBefore = this.shadowRoot.activeElement;
    const dialog = document.createElement('dialog');
    this._dialog = dialog;
    dialog.setAttribute('aria-label', 'Leitura da noticia');
    dialog.innerHTML = '<div class="modal-header"><span>Notícia</span><button class="modal-close" type="button" autofocus>Fechar ✕</button></div><div class="modal-body"></div>';
    const articleUrl = this._safeUrl(article.link);
    if (articleUrl) this._addReader(dialog, article, articleUrl);
    dialog.querySelector('.modal-close').onclick = () => dialog.close();
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      
      clearTimeout(this._readerTimer);
      dialog.remove();
      if (this._dialog !== dialog) return;
      this._dialog = null;
      if (!this.isConnected) return;
      if (this._hass) this.hass = this._hass;
      if (focusBefore?.isConnected) focusBefore.focus({preventScroll:true});
      this._interact();
    });
    this.shadowRoot.append(dialog);
    dialog.showModal();
    this._schedule();
  }
  _addReader(dialog, article, url) {
    const body = dialog.querySelector('.modal-body');
    const tools = document.createElement('div'); tools.className = 'reader-tools';
    tools.innerHTML = '<button type="button" class="show-qr">Não abriu? Ler no celular</button><button type="button" class="retry-frame" hidden>Tentar no painel</button><span class="reader-status" role="status"></span>';
    const frame = document.createElement('iframe'); frame.className = 'article-frame'; frame.title = 'Matéria completa';
    // News pages may run scripts, but cannot navigate the kiosk or open popups.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-storage-access-by-user-activation');
    frame.referrerPolicy = 'no-referrer';
    const panel = document.createElement('div'); panel.className = 'qr-panel'; panel.hidden = true;
    panel.innerHTML = '<strong>Leia a notícia completa no celular</strong><p>Aponte a câmera para o QR Code.</p><canvas aria-label="QR Code do link da notícia" role="img"></canvas><p class="qr-url"></p>';
    panel.querySelector('.qr-url').textContent = url;
    let drawn = false;
    const showQr = message => {
      clearTimeout(this._readerTimer);
      
      frame.hidden = true; frame.removeAttribute('src');
      panel.hidden = false;
      tools.querySelector('.retry-frame').hidden = false;
      tools.querySelector('.reader-status').textContent = message;
      if (!drawn) {
        try {
          const qr = rssQr(0, 'M'); qr.addData(url); qr.make();
          const n = qr.getModuleCount(), scale = 6, quiet = 4;
          const canvas = panel.querySelector('canvas'); canvas.width = canvas.height = (n + quiet*2)*scale;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.fillStyle = '#000';
          for (let y=0;y<n;y++) for (let x=0;x<n;x++) if(qr.isDark(y,x)) ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);
          drawn = true;
        } catch {
          panel.querySelector('canvas').hidden = true;
          panel.querySelector('p').textContent = 'Não foi possível gerar o QR Code. Use o endereço abaixo.';
        }
      }
    };
    const load = () => {
      clearTimeout(this._readerTimer);
      panel.hidden=true;frame.hidden=false;
      tools.querySelector('.retry-frame').hidden=true;
      tools.querySelector('.reader-status').textContent='Carregando site…';
      frame.onload = () => {
        if (frame.hidden) return;
        clearTimeout(this._readerTimer);
        
        tools.querySelector('.reader-status').textContent='Se a página não aparecer, use o QR Code.';
      };
      frame.onerror = () => showQr('Não foi possível abrir o site no painel.');
      frame.src = url;
      this._readerTimer = setTimeout(() => showQr('O site demorou para responder. Continue no celular.'), 15000);
    };
    tools.querySelector('.show-qr').onclick=()=>showQr('Continue a leitura no celular.');
    tools.querySelector('.retry-frame').onclick=load;
    dialog.querySelector('.modal-header').insertBefore(tools, dialog.querySelector('.modal-close'));
    body.append(frame,panel);
    if (article.embed_blocked === true) showQr('Este site informa que bloqueia a exibição dentro do painel.');
    else if (location.protocol === 'https:' && new URL(url).protocol === 'http:') showQr('Abra este endereço no celular.');
    else load();
  }
}

