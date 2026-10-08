export type CarouselSelection = { projectId: string; index: number };

class GlassCarousel extends HTMLElement {
  private cards: HTMLElement[] = [];
  private visibleCards: HTMLElement[] = [];
  private index = 0;
  private timer?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private observer?: IntersectionObserver;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private playing = false;
  private inView = false;
  /** Optional callback for programmatic consumers, alongside carousel:select. */
  onSelect?: (selection: CarouselSelection) => void;

  private get locale(): 'fr' | 'en' {
    return document.documentElement.lang === 'en' ? 'en' : 'fr';
  }

  connectedCallback() {
    if (this.controller) return;
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.cards = [...this.querySelectorAll<HTMLElement>('.glass-card')];
    this.visibleCards = [...this.cards];
    this.index = Math.max(0, Math.min(this.cards.length - 1, Number(this.dataset.initialIndex) || 0));
    this.querySelectorAll<HTMLElement>('.glass-carousel__controls, .glass-carousel__filters, .glass-carousel__hint').forEach((el) => { el.hidden = false; });
    this.dataset.enhanced = 'true';
    this.setAttribute('aria-roledescription', this.locale === 'en' ? 'carousel' : 'carrousel');
    const stage = this.querySelector<HTMLElement>('.glass-carousel__stage')!;
    stage.tabIndex = 0;
    this.querySelector('[data-prev]')?.addEventListener('click', () => this.move(-1), { signal });
    this.querySelector('[data-next]')?.addEventListener('click', () => this.move(1), { signal });
    this.querySelector('[data-filter]')?.addEventListener('change', (event) => {
      this.stop();
      const value = (event.target as HTMLSelectElement).value;
      this.visibleCards = this.cards.filter((card) => !value || (JSON.parse(card.dataset.technologies!) as string[]).includes(value));
      this.index = 0;
      this.render(true);
    }, { signal });
    this.addEventListener('keydown', (event) => {
      if ((event.target as HTMLElement).closest('select, input, textarea, button')) return;
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -this.index, End: this.visibleCards.length - 1 - this.index };
      if (event.key in offsets) {
        event.preventDefault();
        if ((event.target as HTMLElement).closest('a')) stage.focus({ preventScroll: true });
        this.move(offsets[event.key]);
      }
    }, { signal });
    let pointer: { x: number; y: number; id: number } | undefined;
    let suppressClick = false;
    stage.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0 || (event.target as HTMLElement).closest('a, button')) return;
      pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
      suppressClick = false;
      this.stop();
      stage.setPointerCapture(event.pointerId);
    }, { signal });
    stage.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer = undefined;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        suppressClick = true;
        this.move(dx < 0 ? 1 : -1);
      }
    }, { signal });
    stage.addEventListener('pointercancel', () => { pointer = undefined; }, { signal });
    stage.addEventListener('click', (event) => {
      if (suppressClick) { event.preventDefault(); suppressClick = false; }
    }, { signal, capture: true });
    this.addEventListener('focusin', () => this.stop(), { signal });
    this.addEventListener('mouseenter', () => this.stop(), { signal });
    this.querySelector('[data-play]')?.addEventListener('click', () => {
      if (this.playing) this.stop();
      else if (!this.reduced.matches) { this.playing = true; this.schedule(); }
    }, { signal });
    this.reduced.addEventListener('change', () => {
      if (this.reduced.matches) this.stop();
      this.updatePlayButton();
    }, { signal });
    document.addEventListener('visibilitychange', () => this.schedule(), { signal });
    document.addEventListener('portfolio:languagechange', () => {
      this.setAttribute('aria-roledescription', this.locale === 'en' ? 'carousel' : 'carrousel');
      this.render(false);
      this.updatePlayButton();
    }, { signal });
    this.observer = new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      this.schedule();
    }, { threshold: 0.1 });
    this.observer.observe(this);
    this.querySelectorAll('img').forEach((image) => {
      const fallback = () => {
        image.hidden = true;
        image.parentElement!.classList.add('glass-card__image--unavailable');
        image.parentElement!.querySelector('span')!.textContent = this.locale === 'en' ? 'Preview unavailable' : 'Aperçu indisponible';
      };
      image.addEventListener('error', fallback, { signal });
      if (image.complete && !image.naturalWidth) fallback();
    });
    this.playing = this.dataset.autoPlay === 'true' && !this.reduced.matches;
    this.render(false);
    this.schedule();
  }

  private move(offset: number) {
    this.stop();
    this.index = this.visibleCards.length ? (this.index + offset + this.visibleCards.length) % this.visibleCards.length : 0;
    this.render(true);
  }

  private render(announce: boolean) {
    const count = this.visibleCards.length;
    const english = this.locale === 'en';
    this.cards.forEach((card) => {
      const position = this.visibleCards.indexOf(card);
      let distance = position - this.index;
      if (distance > count / 2) distance -= count;
      if (distance < -count / 2) distance += count;
      card.hidden = position === -1;
      card.dataset.slot = Math.abs(distance) > 2 ? 'hidden' : String(distance);
      const active = position === this.index;
      card.inert = !active;
      card.setAttribute('aria-hidden', String(!active));
      card.setAttribute('aria-roledescription', english ? 'slide' : 'diapositive');
      card.setAttribute('aria-label', `${position + 1} ${english ? 'of' : 'sur'} ${count}: ${card.dataset.title}`);
    });
    const active = this.visibleCards[this.index];
    this.dataset.tone = active?.dataset.tone ?? 'cyan';
    this.querySelector('.glass-carousel__counter')!.textContent = `${String(this.index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
    this.querySelector('.glass-carousel__active-title')!.textContent = active?.dataset.title ?? (english ? 'No project' : 'Aucun projet');
    this.querySelectorAll<HTMLButtonElement>('[data-prev], [data-next]').forEach((button) => { button.disabled = count < 2; });
    const countLabel = this.querySelector('.glass-carousel__count');
    if (countLabel) countLabel.textContent = english ? `${count} project${count === 1 ? '' : 's'}` : `${count} projet${count > 1 ? 's' : ''}`;
    if (announce && active) {
      this.querySelector('[data-announcement]')!.textContent = english
        ? `${active.dataset.title}, project ${this.index + 1} of ${count}`
        : `${active.dataset.title}, projet ${this.index + 1} sur ${count}`;
      const detail = { projectId: active.dataset.projectId!, index: this.index };
      this.dispatchEvent(new CustomEvent(this.dataset.selectEvent || 'carousel:select', { bubbles: true, detail }));
      this.onSelect?.(detail);
    }
  }

  private updatePlayButton() {
    const button = this.querySelector<HTMLButtonElement>('[data-play]');
    if (!button) return;
    button.disabled = this.reduced.matches;
    button.setAttribute('aria-pressed', String(this.playing));
    button.textContent = this.playing
      ? 'Pause'
      : this.reduced.matches
        ? (this.locale === 'en' ? 'Reduced motion' : 'Mouvements réduits')
        : (this.locale === 'en' ? 'Autoplay' : 'Lecture auto');
  }

  private stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.updatePlayButton();
  }

  private schedule() {
    clearInterval(this.timer);
    this.updatePlayButton();
    if (!this.playing || !this.inView || document.hidden || this.reduced.matches || this.visibleCards.length < 2) return;
    this.timer = setInterval(() => {
      this.index = (this.index + 1) % this.visibleCards.length;
      this.render(false);
    }, Math.max(4000, Number(this.dataset.interval) || 6500));
  }

  disconnectedCallback() {
    this.stop();
    this.controller?.abort();
    this.controller = undefined;
    this.observer?.disconnect();
  }
}

if (!customElements.get('glass-carousel')) customElements.define('glass-carousel', GlassCarousel);
