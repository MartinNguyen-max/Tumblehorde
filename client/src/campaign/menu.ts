import { chapterById, CHAPTERS, type ChapterId, isChapterId } from '@tumblehorde/shared';
import { byId } from '../ui/dom.ts';
import { loadSave } from './storage.ts';

export interface CampaignMenuActions {
  onNew: () => void;
  onContinue: () => void;
  /** Play from this chapter on, keeping what the story has saved so far (or a fresh one). */
  onChapter: (id: ChapterId) => void;
}

/** The Campaign card on the landing page: continue the saved story or start a new one. */
export class CampaignMenu {
  private readonly progress = byId('campaign-progress');
  private readonly continueButton = byId('campaign-continue', HTMLButtonElement);
  private readonly newButton = byId('campaign-new', HTMLButtonElement);
  private readonly chapterSelect = byId('campaign-chapter', HTMLSelectElement);

  constructor(actions: CampaignMenuActions) {
    const placeholder = new Option('Choose a chapter…', '');
    this.chapterSelect.append(placeholder, ...CHAPTERS.map((c) => new Option(`${c.number} · ${c.title}`, c.id)));
    this.chapterSelect.addEventListener('change', () => {
      const id = this.chapterSelect.value;
      this.chapterSelect.value = '';
      if (isChapterId(id)) actions.onChapter(id);
    });
    this.continueButton.addEventListener('click', () => actions.onContinue());
    this.newButton.addEventListener('click', () => {
      if (loadSave() && !window.confirm('Start the story over? Your saved progress will be lost.')) return;
      actions.onNew();
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
    this.progress.textContent = chapter.number === 0 ? 'Saved at the prologue.' : `Saved at chapter ${chapter.number}: ${chapter.title}.`;
  }
}
