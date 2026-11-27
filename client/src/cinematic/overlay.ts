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
  private readonly letterText: HTMLDivElement;
  /** Called when the reader presses Continue under a letter. */
  onLetterDone: (() => void) | null = null;
  private readonly choices: HTMLDivElement;
  /** Off while the story is paused, so 1–9 never pick an answer behind the pause menu. */
  choiceKeysEnabled = true;
  private readonly skip: HTMLDivElement;
  private readonly skipFill: HTMLElement;
  private readonly loading: HTMLDivElement;
  private choiceKeys: ((e: KeyboardEvent) => void) | null = null;
  private readonly talkBox: HTMLDivElement;
  private readonly promptBox: HTMLDivElement;
  private readonly statusBox: HTMLDivElement;

  private readonly tagLayer: HTMLDivElement;
  private readonly tagPool: HTMLDivElement[] = [];

  /** Floating labels at screen points (CSS px); an empty list hides them all. */
  setTags(tags: readonly { text: string; x: number; y: number }[]): void {
    while (this.tagPool.length < tags.length) this.tagPool.push(el('div', 'cine-tag', this.tagLayer));
    this.tagPool.forEach((tag, i) => {
      const t = tags[i];
      tag.hidden = !t;
      if (!t) return;
      if (tag.textContent !== t.text) tag.textContent = t.text;
      tag.style.transform = `translate(${t.x}px, ${t.y}px) translate(-50%, -100%)`;
    });
  }

  constructor() {
    this.root = el('div', 'cine', document.body);
    this.root.hidden = true;
    // The fade sits under the bars and the words, so a line can be read over black.
    this.fadeLayer = el('div', 'cine-fade', this.root);
    el('div', 'cine-bar top', this.root);
    el('div', 'cine-bar bottom', this.root);
    this.tagLayer = el('div', 'cine-tags', this.root);
    this.title = el('div', 'cine-title', this.root);
    this.letter = el('div', 'cine-letter', this.root);
    this.letterText = el('div', '', this.letter);
    const done = el('button', 'cine-letter-done', this.letter);
    done.textContent = 'Continue';
    done.addEventListener('click', () => this.onLetterDone?.());
    this.sub = el('div', 'cine-sub', this.root);
    this.choices = el('div', 'cine-choices', this.root);
    this.skip = el('div', 'cine-skip', this.root);
    this.skip.append('Hold Space to skip');
    const meter = el('span', 'meter', this.skip);
    this.skipFill = el('i', '', meter);
    this.loading = el('div', 'cine-loading', document.body);
    this.talkBox = el('div', 'cine-talk', document.body);
    this.talkBox.hidden = true;
    this.promptBox = el('div', 'cine-prompt', document.body);
    this.promptBox.hidden = true;
    this.statusBox = el('div', 'cine-status', document.body);
    this.statusBox.hidden = true;
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
    this.setSkip(0, false);
    this.fade(0);
    this.talk(null, null);
    this.prompt(null);
    this.status(null);
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
    if (text !== null) this.letterText.textContent = text;
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
      if (!this.choiceKeysEnabled) return;
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

  /** The talk box at the bottom in free roam; null hides it. */
  talk(speaker: string | null, text: string | null, hint = 'E to go on', progress?: number): void {
    if (text === null) {
      this.talkBox.hidden = true;
      return;
    }
    this.talkBox.replaceChildren();
    if (speaker) el('span', 'who', this.talkBox).textContent = speaker;
    this.talkBox.append(text);
    if (progress !== undefined) {
      const bar = el('span', 'meter', this.talkBox);
      el('i', '', bar).style.width = `${Math.round(Math.min(1, progress) * 100)}%`;
    }
    if (hint) el('span', 'hint', this.talkBox).textContent = hint;
    this.talkBox.hidden = false;
  }

  /** A short hint in the middle of the screen, like "E Talk to Varro"; null hides it. */
  prompt(text: string | null): void {
    this.promptBox.hidden = text === null;
    if (text !== null) this.promptBox.textContent = text;
  }

  /** A small line in the top left corner (gold, strength); null hides it. */
  status(text: string | null): void {
    this.statusBox.hidden = text === null;
    if (text !== null && this.statusBox.textContent !== text) this.statusBox.textContent = text;
  }

  /** The chapter card; `note` is one short extra line (who fell in the battle before). */
  showLoading(chapter: Chapter | null, note: string | null = null): void {
    if (!chapter) {
      this.loading.classList.remove('on');
      return;
    }
    this.loading.replaceChildren();
    el('div', 'num', this.loading).textContent = chapter.number === 0 ? 'The story of Cassian' : `Chapter ${chapter.number}`;
    el('h2', '', this.loading).textContent = chapter.title;
    el('p', '', this.loading).textContent = chapter.loadingLine;
    if (note) el('p', 'note', this.loading).textContent = note;
    this.loading.classList.add('on');
  }
}
