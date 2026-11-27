/**
 * Esc during the story: a small menu to go on or to leave (the story is saved at the last
 * checkpoint).
 */

export interface PauseActions {
  onResume: () => void;
  onLeave: () => void;
}

export class CampaignPause {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly text: HTMLParagraphElement;
  private readonly resume: HTMLButtonElement;
  private toggleWanted = false;
  open = false;

  constructor(actions: PauseActions) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    this.title = document.createElement('h2');
    this.text = document.createElement('p');
    this.text.className = 'hint';
    const row = document.createElement('div');
    row.className = 'row';
    this.resume = document.createElement('button');
    this.resume.className = 'btn primary';
    this.resume.textContent = 'Resume';
    this.resume.addEventListener('click', () => {
      this.hide();
      actions.onResume();
    });
    const leave = document.createElement('button');
    leave.className = 'btn';
    leave.textContent = 'Leave to menu';
    leave.addEventListener('click', () => actions.onLeave());
    row.append(this.resume, leave);
    dialog.append(this.title, this.text, row);
    this.root.append(dialog);
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !e.repeat) this.toggleWanted = true;
    });
  }

  /** True once per Esc press. */
  consumeToggle(): boolean {
    const wanted = this.toggleWanted;
    this.toggleWanted = false;
    return wanted;
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show('Paused', 'Your story is saved at the start of each chapter.', true);
  }

  private show(title: string, text: string, canResume: boolean): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.resume.hidden = !canResume;
    this.root.hidden = false;
    this.open = true;
  }

  hide(): void {
    this.root.hidden = true;
    this.open = false;
  }
}
