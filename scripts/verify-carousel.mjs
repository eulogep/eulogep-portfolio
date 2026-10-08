/* global fetch, WebSocket, console, process, setTimeout */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const debug = `http://127.0.0.1:${process.env.CHROME_DEBUG_PORT || '9223'}`;
const captureDir = process.env.CAPTURE_DIR || '/tmp/portfolio-carousel-review';
await mkdir(captureDir, { recursive: true });
const target = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
const pending = new Map();
const errors = [];
let sequence = 0;
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args);
  const request = pending.get(message.id);
  if (request) {
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  }
});
function call(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const active = () => evaluate(`document.querySelector('glass-carousel .glass-card[data-slot="0"]').dataset.projectId`);
async function settle() { await evaluate('new Promise(resolve => setTimeout(resolve, 750))'); }
async function navigate(route, width) {
  await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await call('Page.navigate', { url: origin + route });
  await evaluate(`new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (document.querySelector('glass-carousel[data-enhanced]')) resolve(true);
      else if (++attempts > 100) reject(new Error('Carousel did not initialize'));
      else setTimeout(check, 50);
    }; check();
  })`);
  await evaluate(`document.querySelector('glass-carousel').scrollIntoView({block:'center'})`);
  await settle();
}
async function capture(name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${captureDir}/${name}.png`, Buffer.from(data, 'base64'));
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  const responsive = [];
  for (const route of ['/', '/projects/']) {
    for (const width of [320, 390, 768, 1440]) {
      await navigate(route, width);
      const result = await evaluate(`(() => {
        const card = document.querySelector('.glass-card[data-slot="0"]');
        const stage = document.querySelector('.glass-carousel__stage').getBoundingClientRect();
        const box = card.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          activeCount: document.querySelectorAll('.glass-card:not([inert]):not([hidden])').length,
          fits: box.left >= stage.left && box.right <= stage.right && box.bottom <= stage.bottom,
          brokenImages: [...document.querySelectorAll('glass-carousel img')].filter(i => i.complete && !i.naturalWidth).length };
      })()`);
      assert.equal(result.overflow, false, `${route} ${width}: overflow`);
      assert.equal(result.activeCount, 1);
      assert.equal(result.fits, true, `${route} ${width}: clipped active card`);
      assert.equal(result.brokenImages, 0);
      responsive.push({ route, width, ...result });
      if (width === 390 || width === 1440) await capture(`${route === '/' ? 'hero' : 'showcase'}-${width}`);
    }
  }
  const first = await active();
  await evaluate(`document.querySelector('[data-next]').click()`);
  assert.notEqual(await active(), first, 'Next must select a new project');
  await evaluate(`document.querySelector('[data-prev]').click()`);
  assert.equal(await active(), first, 'Previous must restore first project');
  await evaluate(`document.querySelector('.glass-carousel__stage').focus()`);
  const lastProject = await evaluate(`[...document.querySelectorAll('.glass-card:not([hidden])')].at(-1).dataset.projectId`);
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End' });
  assert.equal(await active(), lastProject);
  await settle();
  await capture('showcase-secondary-1440');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight' });
  assert.equal(await active(), first, 'Navigation must wrap');
  await evaluate(`document.querySelector('[data-filter]').value = 'Python'; document.querySelector('[data-filter]').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`[...document.querySelectorAll('.glass-card:not([hidden])')].every(c => JSON.parse(c.dataset.technologies).includes('Python'))`), true);
  await evaluate(`document.querySelector('[data-filter]').value = ''; document.querySelector('[data-filter]').dispatchEvent(new Event('change'))`);

  // Real touch dispatch, rather than calling the selection method directly.
  await navigate('/projects/', 390);
  const touch = await evaluate(`(() => { const r=document.querySelector('.glass-card[data-slot="0"] .glass-card__image').getBoundingClientRect(); return {x:r.left+r.width*.75,y:r.top+50}; })()`);
  await call('Emulation.setTouchEmulationEnabled', { enabled: true });
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x, y: touch.y }] });
  await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x - 120, y: touch.y }] });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(await active(), first, 'Touch swipe must change selection');

  // A second instance on the same page must not share selection state.
  await evaluate(`(() => { const clone = document.querySelector('glass-carousel').cloneNode(true); clone.id='independence-test'; document.querySelector('main').append(clone); })()`);
  const cloneBefore = await evaluate(`document.querySelector('#independence-test .glass-card[data-slot="0"]').dataset.projectId`);
  await evaluate(`document.querySelector('glass-carousel [data-next]').click()`);
  assert.equal(await evaluate(`document.querySelector('#independence-test .glass-card[data-slot="0"]').dataset.projectId`), cloneBefore);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.glass-card')).transitionDuration) <= 0.001`));
  await evaluate(`document.querySelector('#independence-test').remove()`);

  // Autoplay is opt-in, respects reduced motion, and stops on interaction.
  await evaluate(`(() => {
    const clone = document.querySelector('glass-carousel').cloneNode(true);
    clone.id='autoplay-test'; clone.dataset.autoPlay='true'; clone.dataset.interval='4000';
    const button=document.createElement('button'); button.dataset.play='';
    clone.querySelector('.glass-carousel__controls').append(button);
    document.querySelector('main').append(clone); clone.scrollIntoView({block:'center'});
  })()`);
  assert.equal(await evaluate(`document.querySelector('#autoplay-test [data-play]').disabled`), true);
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
  await settle();
  await evaluate(`document.querySelector('#autoplay-test [data-play]').click()`);
  assert.equal(await evaluate(`document.querySelector('#autoplay-test [data-play]').getAttribute('aria-pressed')`), 'true');
  const autoBefore = await evaluate(`document.querySelector('#autoplay-test .glass-card[data-slot="0"]').dataset.projectId`);
  await evaluate('new Promise(resolve => setTimeout(resolve, 4200))');
  assert.notEqual(await evaluate(`document.querySelector('#autoplay-test .glass-card[data-slot="0"]').dataset.projectId`), autoBefore);
  await evaluate(`document.querySelector('#autoplay-test .glass-carousel__stage').focus()`);
  assert.equal(await evaluate(`document.querySelector('#autoplay-test [data-play]').getAttribute('aria-pressed')`), 'false');
  await evaluate(`document.querySelector('#autoplay-test').remove()`);

  // No-JS fallback keeps every project's links reachable.
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await call('Page.navigate', { url: origin + '/projects/' });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  assert.equal(await evaluate(`document.querySelectorAll('.glass-card[inert]').length`), 0);
  assert.equal(await evaluate(`document.querySelectorAll('.glass-card').length`), 12);
  assert.equal(await evaluate(`[...document.querySelectorAll('.glass-card')].every(card => card.querySelector('a'))`), true);
  assert.deepEqual(errors, [], 'Browser console errors');
  console.log(JSON.stringify({ status: 'PASS', responsive, interactions: ['previous', 'next', 'keyboard', 'wraparound', 'technology filter', 'touch swipe', 'independent instances', 'reduced motion', 'autoplay opt-in and pause', 'no-JS fallback'], consoleErrors: errors, captureDir }, null, 2));
} finally {
  await fetch(`${debug}/json/close/${target.id}`);
  ws.close();
}
