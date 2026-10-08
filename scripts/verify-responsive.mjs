/* global process, fetch, WebSocket, URL, console */

import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";

const debuggerPort = process.env.CHROME_DEBUG_PORT ?? "9223";
const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:4321";

const target = await fetch(`http://127.0.0.1:${debuggerPort}/json/new?about:blank`, {
  method: "PUT",
}).then((response) => {
  if (!response.ok) throw new Error(`Cannot create Chrome target: ${response.status}`);
  return response.json();
});

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = new Map();

socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data.toString());
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  const waiters = events.get(message.method) ?? [];
  events.delete(message.method);
  for (const resolve of waiters) resolve(message.params);
});

function call(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function waitFor(method) {
  return new Promise((resolve) => {
    events.set(method, [...(events.get(method) ?? []), resolve]);
  });
}

async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(path, width) {
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  const loaded = waitFor("Page.loadEventFired");
  await call("Page.navigate", { url: new URL(path, baseUrl).href });
  await loaded;
  return evaluate(`(() => ({
    path: location.pathname,
    width: innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
    brokenImages: [...document.images].filter((image) => image.complete && image.naturalWidth === 0).length,
    h1: document.querySelectorAll('h1').length,
    desktopNavVisible: getComputedStyle(document.querySelector('.desktop-nav')).display !== 'none',
    mobileNavVisible: getComputedStyle(document.querySelector('.mobile-nav')).display !== 'none',
    languageSelectors: document.querySelectorAll('[data-language-select]').length,
    footerBrand: Boolean(document.querySelector('.footer-brand img[alt=""]')),
    journeyChapters: document.querySelectorAll('.journey-chapter').length,
    galleryCards: document.querySelectorAll('.gallery-card').length,
    presentationVideos: document.querySelectorAll('.project-presentation video').length
  }))()`);
}

await call("Page.enable");
await call("Runtime.enable");

const widths = [320, 375, 390, 768, 1024, 1280, 1440];
const results = [];
for (const width of widths) results.push(await navigate("/", width));
for (const width of [320, 390, 768, 1440]) {
  results.push(await navigate("/projects/engineer-learning-os/", width));
  results.push(await navigate("/projects/manga-wave/", width));
}
for (const width of widths) results.push(await navigate("/parcours/", width));

await navigate("/", 390);
await evaluate("document.body.focus()");
await call("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab" });
await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
const firstFocus = await evaluate(
  "({tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href')})",
);

await call("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
const reducedMotion = await evaluate(`(() => {
  const card = document.querySelector('.project-card');
  return {
    matched: matchMedia('(prefers-reduced-motion: reduce)').matches,
    transitionDuration: card ? getComputedStyle(card).transitionDuration : null,
    animationDuration: card ? getComputedStyle(card).animationDuration : null
  };
})()`);

await call("Emulation.setEmulatedMedia", {
  features: [{ name: "forced-colors", value: "active" }],
});
const forcedColors = await evaluate(`(() => {
  const decoration = document.querySelector('.hero-decoration');
  return {
    matched: matchMedia('(forced-colors: active)').matches,
    decorationDisplay: decoration ? getComputedStyle(decoration).display : null
  };
})()`);

const failures = results.filter(
  (result) =>
    result.width !== result.clientWidth ||
    result.overflow ||
    result.brokenImages ||
    result.h1 !== 1 ||
    result.languageSelectors !== 1 ||
    !result.footerBrand ||
    (result.path === '/projects/manga-wave/' && result.presentationVideos !== 1) ||
    (result.path === '/parcours/' && (result.journeyChapters !== 6 || result.galleryCards !== 4)),
);

if (process.env.CAPTURE_DIR) {
  await mkdir(process.env.CAPTURE_DIR, { recursive: true });
  await call('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  for (const route of [
    { path: '/', name: 'home' },
    { path: '/about/', name: 'about' },
    { path: '/parcours/', name: 'parcours' },
    { path: '/projects/manga-wave/', name: 'manga-wave' },
  ]) {
    for (const width of [390, 1440]) {
      await navigate(route.path, width);
      const { data } = await call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true,
      });
      await writeFile(`${process.env.CAPTURE_DIR}/${route.name}-${width}.png`, Buffer.from(data, 'base64'));
    }
  }
  await navigate('/parcours/', 1440);
  await evaluate(`new Promise((resolve) => {
    document.querySelector('#gallery-title')?.scrollIntoView({ block: 'start' });
    setTimeout(resolve, 700);
  })`);
  const { data: galleryData } = await call('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  await writeFile(`${process.env.CAPTURE_DIR}/parcours-gallery-1440.png`, Buffer.from(galleryData, 'base64'));
}

console.log(JSON.stringify({ results, firstFocus, reducedMotion, forcedColors, failures }, null, 2));
await fetch(`http://127.0.0.1:${debuggerPort}/json/close/${target.id}`);
socket.close();

if (
  failures.length ||
  firstFocus.href !== "#contenu" ||
  !reducedMotion.matched ||
  !forcedColors.matched
) {
  process.exitCode = 1;
}
