/* global fetch, WebSocket, process, console */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4321';
const debug = `http://127.0.0.1:${process.env.CHROME_DEBUG_PORT || '9223'}`;
const captureDir = process.env.CAPTURE_DIR || '/tmp/portfolio-language-review';
await mkdir(captureDir, { recursive: true });

const target = await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' }).then((response) => {
  if (!response.ok) throw new Error(`Cannot create Chrome target: ${response.status}`);
  return response.json();
});
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data.toString());
  if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') browserErrors.push(message.params.args);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(route, width = 1440) {
  await call('Emulation.setDeviceMetricsOverride', { width, height: 960, deviceScaleFactor: 1, mobile: width < 768 });
  await call('Page.navigate', { url: origin + route });
  await evaluate(`new Promise((resolve, reject) => {
    let attempts = 0;
    const ready = () => {
      if (document.readyState === 'complete' && document.querySelector('[data-language-select]')) resolve(true);
      else if (++attempts > 100) reject(new Error('Language selector did not initialize'));
      else setTimeout(ready, 50);
    };
    ready();
  })`);
}

async function state() {
  return evaluate(`(() => ({
    language: document.documentElement.lang,
    selected: document.querySelector('[data-language-select]').value,
    stored: localStorage.getItem('eulogep-portfolio-language'),
    query: location.search,
    nav: [...document.querySelectorAll('.desktop-nav a')].map((link) => link.textContent.trim()),
    h1: document.querySelector('h1')?.textContent.trim(),
    title: document.title,
    count: document.querySelector('.glass-carousel__count')?.textContent.trim(),
    next: document.querySelector('[data-next]')?.textContent.trim(),
    selectorCount: document.querySelectorAll('[data-language-select]').length,
    overflow: document.documentElement.scrollWidth > innerWidth
  }))()`);
}

async function select(locale) {
  await evaluate(`(() => {
    const select = document.querySelector('[data-language-select]');
    select.value = '${locale}';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await evaluate('new Promise((resolve) => setTimeout(resolve, 100))');
}

async function capture(name) {
  await evaluate('new Promise((resolve) => setTimeout(resolve, 700))');
  const { data } = await call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(`${captureDir}/${name}.png`, Buffer.from(data, 'base64'));
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await navigate('/?lang=fr');
  await evaluate("localStorage.removeItem('eulogep-portfolio-language')");
  assert.equal((await state()).language, 'fr');

  await select('en');
  const homeEnglish = await state();
  assert.equal(homeEnglish.language, 'en');
  assert.equal(homeEnglish.selected, 'en');
  assert.equal(homeEnglish.stored, 'en');
  assert.equal(homeEnglish.query, '?lang=en');
  assert.equal(homeEnglish.nav[0], 'Home');
  assert.equal(homeEnglish.selectorCount, 1);
  assert.equal(homeEnglish.overflow, false);
  await capture('home-en-1440');

  await navigate('/projects/');
  const projectsEnglish = await state();
  assert.equal(projectsEnglish.language, 'en');
  assert.equal(projectsEnglish.h1, 'Projects');
  assert.equal(projectsEnglish.title, 'Projects — Euloge Mabiala');
  assert.equal(projectsEnglish.count, '12 projects');
  assert.equal(projectsEnglish.next, 'Next');
  assert.equal(projectsEnglish.overflow, false);

  await navigate('/about/');
  const aboutEnglish = await state();
  assert.equal(aboutEnglish.language, 'en');
  assert.equal(aboutEnglish.h1, 'About');
  assert.equal(aboutEnglish.title, 'About — Euloge Mabiala');
  assert.equal(aboutEnglish.overflow, false);

  await navigate('/parcours/', 390);
  const journeyEnglish = await state();
  assert.equal(journeyEnglish.language, 'en');
  assert.equal(journeyEnglish.h1, 'From scientific foundations to real systems.');
  assert.equal(journeyEnglish.title, 'Journey — Euloge Mabiala');
  assert.equal(journeyEnglish.overflow, false);
  await capture('journey-en-390');

  await select('fr');
  const journeyFrench = await state();
  assert.equal(journeyFrench.language, 'fr');
  assert.equal(journeyFrench.selected, 'fr');
  assert.equal(journeyFrench.stored, 'fr');
  assert.equal(journeyFrench.query, '');
  assert.equal(journeyFrench.h1, 'Des fondations scientifiques aux systèmes réels.');

  await navigate('/', 1440);
  const homeFrench = await state();
  assert.equal(homeFrench.language, 'fr');
  assert.equal(homeFrench.nav[0], 'Accueil');
  assert.equal(homeFrench.overflow, false);
  await capture('home-fr-1440');

  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({
    status: 'PASS',
    locales: ['fr', 'en'],
    persistence: 'PASS',
    routes: ['/', '/projects/', '/about/', '/parcours/'],
    responsiveWidths: [390, 1440],
    browserErrors,
    captureDir,
  }, null, 2));
} finally {
  await fetch(`${debug}/json/close/${target.id}`);
  socket.close();
}
