import { BOOKS, bookLabel, bookOf, CHAPTERS, type ChapterId, chapterById, chapterInBook, chapterLabel, isChapterId, type Son } from '@tumblehorde/shared';
import { byId } from '../ui/dom.ts';
import { loadSave } from './storage.ts';

export interface CampaignMenuActions {
  onNew: () => void;
  onContinue: () => void;
  /** Testing: play from any chapter, following the given son at the end. */
  onJump: (chapter: ChapterId, son: Son) => void;
}

/** The Campaign card on the landing page: continue the saved story or start a new one. */
export class CampaignMenu {
  private readonly progress = byId('campaign-progress');
  private readonly continueButton = byId('campaign-continue', HTMLButtonElement);
  private readonly newButton = byId('campaign-new', HTMLButtonElement);
  private readonly chapterSelect = byId('campaign-chapter', HTMLSelectElement);
  private readonly sonSelect = byId('campaign-son', HTMLSelectElement);
  private readonly jumpButton = byId('campaign-jump', HTMLButtonElement);

  constructor(actions: CampaignMenuActions) {
    this.continueButton.addEventListener('click', () => actions.onContinue());
    this.newButton.addEventListener('click', () => {
      if (loadSave() && !window.confirm('Start the story over? Your saved progress will be lost.')) return;
      actions.onNew();
    });
    for (const book of BOOKS) {
      const group = document.createElement('optgroup');
      group.label = bookLabel(book);
      for (const chapter of CHAPTERS.filter((c) => bookOf(c.id) === book)) {
        const option = document.createElement('option');
        option.value = chapter.id;
        const n = chapterInBook(chapter.id);
        option.textContent = n === 0 ? chapter.title : `${n}. ${chapter.title}`;
        group.append(option);
      }
      this.chapterSelect.append(group);
    }
    this.jumpButton.addEventListener('click', () => {
      const id = this.chapterSelect.value;
      if (!isChapterId(id)) return;
      actions.onJump(id, this.sonSelect.value === 'marcus' ? 'marcus' : 'lucius');
    });
    this.refresh();
  }

  /** Shows where the saved story stands. */
  refresh(): void {
    const save = loadSave();
    this.continueButton.hidden = save === null;
    this.newButton.classList.toggle('primary', save === null);
    if (!save) {
      this.progress.textContent = 'From monk to legend: one long story.';
      return;
    }
    const chapter = chapterById(save.chapter);
    this.progress.textContent = `Saved at ${chapterLabel(chapter.id)}: ${chapter.title}.`;
  }
}
