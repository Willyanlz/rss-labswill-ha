import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const bundle = fileURLToPath(new URL('../rss-labswill-ha.js', import.meta.url));
async function mount(page, config = {}) {
  await page.clock.install();
  await page.setContent('<style>body{margin:24px;background:#111827;color:#e5e7eb;font:16px system-ui;--primary-color:#38bdf8;--text-primary-color:#082f49;--primary-text-color:#e5e7eb;--secondary-text-color:#94a3b8;--card-background-color:#182235;--secondary-background-color:#253248;--divider-color:#334155;--ha-card-border-radius:20px}rss-news-card{max-width:520px}</style>');
  await page.addScriptTag({ path: bundle });
  await page.evaluate(config => {
    const card = document.createElement('rss-news-card');
    window.card = card;
    card.setConfig({ sources: [{ entity: 'sensor.news', name: 'LabsWill Notícias' }], slide_interval: 3, interaction_timeout: 5, pause_timeout: 6, ...config });
    card.hass = { states: { 'sensor.news': { attributes: { articles: [1, 2, 3].map(i => ({title: `Notícia ${i}: tecnologia para uma casa conectada`, link: `https://example.com/${i}`, pubDate: '2026-09-30T12:00:00Z', embed_blocked: true})) } } } };
    document.body.append(card);
  }, config);
  await expect(page.locator('.counter')).toHaveText('1 / 3');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
const advance = (page, ms) => page.clock.runFor(ms);
const index = page => page.evaluate(() => card._index);

test('autoplay wraps, and repeated HA data/observer callbacks do not starve timer', async ({page}) => {
  await mount(page);
  for (let i = 0; i < 9; i++) {
    await advance(page, 1000);
    await page.evaluate(() => {
      card._hass.states['sensor.news'].attributes.articles[0].description = String(Date.now());
      card.hass = card._hass;
      card._schedule();
    });
  }
  expect(await index(page)).toBe(0);
  await advance(page, 3000);
  expect(await index(page)).toBe(1);
});
test('next and previous resume despite retained button focus and hover', async ({page}) => {
  await mount(page);
  await page.locator('.next').click();
  expect(await index(page)).toBe(1);
  await advance(page, 4900);
  expect(await index(page)).toBe(1);
  await advance(page, 200);
  expect(await index(page)).toBe(2);
  await page.locator('.previous').click();
  expect(await index(page)).toBe(1);
  await advance(page, 5100);
  expect(await index(page)).toBe(2);
});
test('pause resumes after inactivity, play resumes immediately with a full interval', async ({page}) => {
  await mount(page);
  await page.locator('.pause').click();
  await advance(page, 6100);
  await expect(page.locator('.pause')).toHaveAttribute('aria-pressed', 'false');
  expect(await index(page)).toBe(0);
  await advance(page, 3000);
  expect(await index(page)).toBe(1);
  await page.locator('.pause').click();
  await page.locator('.pause').click();
  await advance(page, 3100);
  expect(await index(page)).toBe(2);
});
test('permanent pause and disabled initial autoplay both allow manual play', async ({page}) => {
  await mount(page, {pause_timeout: 0, autoplay: false});
  await advance(page, 120000);
  expect(await index(page)).toBe(0);
  await page.locator('.pause').click();
  await advance(page, 3100);
  expect(await index(page)).toBe(1);
  await page.locator('.pause').click();
  await advance(page, 120000);
  expect(await index(page)).toBe(1);
});
test('modal freezes article, applies updated feed on close and resumes with focus restored', async ({page}) => {
  await mount(page);
  await page.locator('article').first().locator('.headline').click();
  await expect(page.locator('dialog')).toBeVisible();
  await advance(page, 30000);
  expect(await index(page)).toBe(0);
  await page.evaluate(() => {card._hass.states['sensor.news'].attributes.articles[0].title = 'Atualizada';card.hass = card._hass;});
  await page.locator('.modal-close').click();
  await expect(page.locator('article').first().locator('.headline')).toHaveText('Atualizada');
  await advance(page, 5100);
  expect(await index(page)).toBe(1);
});
test('offscreen, hidden tab, disconnect and reconnect suspend without duplicate timers', async ({page}) => {
  await mount(page);
  await page.evaluate(() => {card._visible = false;card._schedule(true);});
  await advance(page, 30000);
  expect(await index(page)).toBe(0);
  await page.evaluate(() => {card._visible = true;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await advance(page, 30000);
  expect(await index(page)).toBe(0);
  await page.evaluate(() => {Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await advance(page, 3100);
  expect(await index(page)).toBe(1);
  await page.evaluate(() => card.remove());
  await advance(page, 30000);
  expect(await index(page)).toBe(1);
  await page.evaluate(() => document.body.append(card));
  await advance(page, 3100);
  expect(await index(page)).toBe(2);
});
test('swipe and touch cancellation resume; events do not escape to dashboard', async ({page}) => {
  await mount(page);
  const escaped = await page.evaluate(() => {
    let count = 0;
    document.addEventListener('touchstart', () => count++);
    const viewport = card.shadowRoot.querySelector('.viewport');
    const send = (type, x, y) => {
      const touch = new Touch({identifier:1,target:viewport,clientX:x,clientY:y});
      viewport.dispatchEvent(new TouchEvent(type,{bubbles:true,composed:true,cancelable:true,touches:type==='touchstart'?[touch]:[],changedTouches:[touch]}));
    };
    send('touchstart', 200, 100);send('touchend', 50, 100);
    send('touchstart', 200, 100);send('touchcancel', 200, 100);
    return count;
  });
  expect(escaped).toBe(0);
  expect(await index(page)).toBe(1);
  await advance(page, 5100);
  expect(await index(page)).toBe(2);
});
test('zero, one, malformed articles and invalid interval configuration are safe', async ({page}) => {
  await mount(page, {slide_interval: 'Infinity'});
  await page.evaluate(() => { card.hass = {states:{'sensor.news':{attributes:{articles:[null, {}, {title:'Única'}]}}}}; });
  await expect(page.locator('.navigation')).toBeHidden();
  await advance(page, 30000);
  expect(await index(page)).toBe(0);
  await page.evaluate(() => {card.hass = {states:{}};});
  await expect(page.locator('.empty')).toBeVisible();
});
test('keyboard navigation and mobile controls remain accessible', async ({page}) => {
  await page.setViewportSize({width:320,height:800});
  await mount(page);
  await page.locator('.viewport').focus();
  await page.keyboard.press('ArrowRight');
  expect(await index(page)).toBe(1);
  await advance(page, 5100);
  expect(await index(page)).toBe(2);
  const size = await page.locator('.pause').boundingBox();
  expect(size.width).toBeGreaterThanOrEqual(44);
  expect(size.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('preview', async ({page}) => {
  await page.route('https://preview.test/cover.svg', route => route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="bg"><stop stop-color="#0c4a6e"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient></defs><rect width="960" height="540" fill="url(#bg)"/><circle cx="740" cy="100" r="250" fill="#38bdf8" opacity=".08"/><path d="M360 310v110h240V310M320 310l160-140 160 140" fill="none" stroke="#7dd3fc" stroke-width="14" stroke-linejoin="round"/><path d="M450 420v-90h60v90" fill="none" stroke="#7dd3fc" stroke-width="12"/><circle cx="690" cy="210" r="9" fill="#38bdf8"/><path d="M670 185q20-20 40 0m-55-20q35-35 70 0" fill="none" stroke="#38bdf8" stroke-width="7" stroke-linecap="round"/><text x="48" y="62" fill="#bae6fd" font-family="sans-serif" font-size="18" letter-spacing="5">LABSWILL • CASA CONECTADA</text></svg>'}));
  await mount(page, {title:'O mundo, na sua casa', slide_interval:8});
  await page.evaluate(() => {
    card._hass.states['sensor.news'].attributes.articles[0].image = 'https://preview.test/cover.svg';
    card.hass = card._hass;
  });
  await expect(page.locator('article').first().locator('img')).toBeVisible();
  await page.locator('article').first().locator('img').evaluate(img => img.decode());
  await page.locator('rss-news-card').screenshot({path:'docs/preview.png'});
});

test('continuous activity delays resumption until the last interaction', async ({page}) => {
  await mount(page);
  for (let i=0;i<5;i++) {
    await advance(page, 2000);
    await page.locator('ha-card').dispatchEvent('pointermove');
    expect(await index(page)).toBe(0);
  }
  await advance(page, 5100);
  expect(await index(page)).toBe(1);
});

test('focus on slide moves safely without adding another idle delay', async ({page}) => {
  await mount(page);
  await page.locator('article').first().locator('.headline').focus();
  await advance(page, 5100);
  expect(await index(page)).toBe(1);
  await expect(page.locator('.viewport')).toBeFocused();
  await advance(page, 3000);
  expect(await index(page)).toBe(2);
});

test('reader timeout offers QR and disconnect clears reader timer', async ({page}) => {
  await mount(page);
  await page.route('https://example.com/**', async route => { /* Simulate a request with no load event. */ });
  await page.evaluate(() => {card._articles[0].embed_blocked = false;card._openArticle(card._articles[0]);});
  await advance(page, 15100);
  await expect(page.locator('.qr-panel')).toBeVisible();
  await expect(page.locator('.reader-status')).toContainText('demorou');
  await page.locator('.retry-frame').click();
  await page.evaluate(() => card.remove());
  await advance(page, 20000);
  expect(await page.evaluate(() => card._dialog)).toBeNull();
});

test('extended autoplay does not freeze or accumulate timers', async ({page}) => {
  await mount(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()));
  await page.evaluate(() => card._schedule(true));
  await advance(page, 300100);
  expect(await index(page)).toBe(1);
  await advance(page, 3000);
  expect(await index(page)).toBe(2);
});
