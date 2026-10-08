import { translationsBySource, type PortfolioLocale } from '../i18n/fr-en';

const STORAGE_KEY = 'eulogep-portfolio-language';
const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ['aria-label', 'title', 'placeholder', 'alt'] as const;
const skippedParents = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT']);

function preferredLocale(): PortfolioLocale {
  const query = new URLSearchParams(location.search).get('lang');
  if (query === 'fr' || query === 'en') return query;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  return stored === 'en' ? 'en' : 'fr';
}

function translateDynamic(source: string, locale: PortfolioLocale): string {
  if (locale === 'fr') return source;
  return source
    .replace(/^(\d+) sur (\d+) : /, '$1 of $2: ')
    .replace(/^Technologies de /, 'Technologies used in ')
    .replace(/^Sortie de l’exécution (\d+) sur (\d+)$/, 'Output from run $1 of $2')
    .replace(/^Extrait de code de /, 'Code excerpt from ')
    .replace(/^Voir l’image (\d+) : /, 'View image $1: ')
    .replace(/^Identité professionnelle (.+)$/, 'Professional identity $1')
    .replace(/^Limite : /, 'Limitation: ')
    .replace(/^(.+) — Étude de projet \| Euloge Mabiala$/, '$1 — Project case study | Euloge Mabiala')
    .replace(/^(.+) — Euloge Mabiala$/, '$1 — Euloge Mabiala')
    .replace(/ — ouvrir le site officiel$/, ' — open official website')
    .replace(/ — s’ouvre dans un nouvel onglet$/, ' — opens in a new tab');
}

function translate(source: string, locale: PortfolioLocale): string {
  const pair = translationsBySource.get(source);
  return pair ? pair[locale === 'fr' ? 0 : 1] : translateDynamic(source, locale);
}

function translateTextNode(node: Text, locale: PortfolioLocale) {
  const source = textSources.get(node) ?? node.nodeValue ?? '';
  if (!textSources.has(node)) textSources.set(node, source);
  const start = source.match(/^\s*/)?.[0] ?? '';
  const end = source.match(/\s*$/)?.[0] ?? '';
  const core = source.slice(start.length, source.length - end.length);
  if (core) node.nodeValue = `${start}${translate(core, locale)}${end}`;
}

function translateElement(element: Element, locale: PortfolioLocale) {
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    if (!sources.has(attribute)) sources.set(attribute, current);
    element.setAttribute(attribute, translate(sources.get(attribute)!, locale));
  }
}

function applyLocale(locale: PortfolioLocale, persist: boolean) {
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  const headWalker = document.createTreeWalker(document.head, NodeFilter.SHOW_TEXT);
  let headNode = headWalker.nextNode();
  while (headNode) {
    const text = headNode as Text;
    if (text.parentElement && !skippedParents.has(text.parentElement.tagName)) translateTextNode(text, locale);
    headNode = headWalker.nextNode();
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    if (text.parentElement && !skippedParents.has(text.parentElement.tagName)) translateTextNode(text, locale);
    node = walker.nextNode();
  }
  document.querySelectorAll('*').forEach((element) => translateElement(element, locale));
  document.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach((select) => { select.value = locale; });
  document.querySelectorAll<HTMLElement>('[data-language-status]').forEach((status) => {
    status.textContent = locale === 'fr' ? 'Portfolio affiché en français.' : 'Portfolio displayed in English.';
  });
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // The URL still reflects the explicit choice when storage is unavailable.
    }
    const url = new URL(location.href);
    if (locale === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    history.replaceState(history.state, '', url);
  }
  document.dispatchEvent(new CustomEvent('portfolio:languagechange', { detail: { locale } }));
}

function initialize() {
  const locale = preferredLocale();
  document.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach((select) => {
    select.addEventListener('change', () => applyLocale(select.value === 'en' ? 'en' : 'fr', true));
  });
  applyLocale(locale, false);
}

initialize();
