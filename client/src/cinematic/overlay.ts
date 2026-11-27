import './cinematic.css';
import type { Chapter } from '@tumblehorde/shared';
import { SCREEN } from './config.ts';

/**
 * The flat layer over a cutscene: black letterbox bars, subtitles and the narrator, title cards,
 * Livia's letters on parchment, choices, fades and the skip meter. Plain DOM, built on demand.
 */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

export type FadeColor = 'black' | 'white';

export class CinematicOverlay {
  private readonly root: HTMLDivElement;
  private readonly fadeLayer: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly letter: HTMLDivElement;
  private readonly choices: HTMLDivElement;
  private readonly skip: HTMLDivElement;
  private readonly skipFill: HTMLElement;
  private readonly loading: HTMLDivElement;
  private choiceKeys: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.root = el('div', 'cine', document.body);
    this.root.hidden = true;
    el('div', 'cine-bar top', this.root);
    el('div', 'cine-bar bottom', this.root);
    this.title = el('div', 'cine-title', this.root);
    this.letter = el('div', 'cine-letter', this.root);
    this.sub = el('div', 'cine-sub', this.root);
    this.choices = el('div', 'cine-choices', this.root);
    this.skip = el('div', 'cine-skip', this.root);
    this.skip.append('Hold Space to skip');
    const meter = el('span', 'meter', this.skip);
    this.skipFill = el('i', '', meter);
    this.fadeLayer = el('div', 'cine-fade', this.root);
    this.loading = el('div', 'cine-loading', document.body);
  }

  show(letterbox = true): void {
    this.root.hidden = false;
    // The bars slide in on the next frame so the transition runs.
    requestAnimationFrame(() => this.root.classList.toggle('letterboxed', letterbox));
  }

  hide(): void {
    this.root.classList.remove('letterboxed');
    this.root.hidden = true;
    this.say(null, null);
    this.setTitle(null);
    this.setLetter(null);
    this.clearChoices();
    this.fade(0);
  }

  /** A spoken line (with the speaker's name) or the narrator (speaker null). Null text clears it. */
  say(speaker: string | null, text: string | null): void {
    if (text === null) {
      this.sub.classList.remove('on');
      return;
    }
    this.sub.replaceChildren();
    this.sub.classList.toggle('narrator', speaker === null);
    if (speaker) {
      const who = el('span', 'who', this.sub);
      who.textContent = speaker;
    }
    this.sub.append(text);
    this.sub.classList.add('on');
  }

  setTitle(title: { text: string; sub?: string } | null): void {
    if (!title) {
      this.title.classList.remove('on');
      return;
    }
    this.title.replaceChildren();
    el('h1', '', this.title).textContent = title.text;
    if (title.sub) el('p', '', this.title).textContent = title.sub;
    this.title.classList.add('on');
  }

  setLetter(text: string | null): void {
    if (text !== null) this.letter.textContent = text;
    this.letter.classList.toggle('on', text !== null);
  }

  /** 0 = clear, 1 = fully black (or white). */
  fade(amount: number, color: FadeColor = 'black', seconds?: number, from?: number): void {
    const layer = this.fadeLayer;
    layer.classList.toggle('white', color === 'white');
    if (from !== undefined) {
      layer.style.transitionDuration = '0s';
      layer.style.opacity = String(from);
      // Reading the layout commits the start value, so the transition runs from it.
      void layer.offsetWidth;
    }
    layer.style.transitionDuration = `${seconds ?? SCREEN.fadeTime}s`;
    layer.style.opacity = String(amount);
  }

  setSkip(progress: number, visible: boolean): void {
    this.skip.classList.toggle('on', visible);
    this.skipFill.style.width = `${Math.round(progress * 100)}%`;
  }

  /** Buttons for a choice; keys 1–9 pick too. */
  offerChoices(options: readonly string[], onPick: (index: number) => void): void {
    this.clearChoices();
    options.forEach((text, i) => {
      const button = el('button', '', this.choices);
      const key = el('kbd', '', button);
      key.textContent = String(i + 1);
      button.append(text);
      button.addEventListener('click', () => {
        this.clearChoices();
        onPick(i);
      });
    });
    this.choiceKeys = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        this.clearChoices();
        onPick(index);
      }
    };
    window.addEventListener('keydown', this.choiceKeys);
  }

  clearChoices(): void {
    this.choices.replaceChildren();
    if (this.choiceKeys) window.removeEventListener('keydown', this.choiceKeys);
    this.choiceKeys = null;
  }

  showLoading(chapter: Chapter | null): void {
    if (!chapter) {
      this.loading.classList.remove('on');
      return;
    }
    this.loading.replaceChildren();
    el('div', 'num', this.loading).textContent = chapter.number === 0 ? 'The story of Cassian' : `Chapter ${chapter.number}`;
    el('h2', '', this.loading).textContent = chapter.title;
    el('p', '', this.loading).textContent = chapter.loadingLine;
    this.loading.classList.add('on');
  }
}
