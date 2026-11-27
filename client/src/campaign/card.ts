/** A card with a few buttons between story moments: "You went down. Fight again?" */

export interface CardButton {
  label: string;
  primary?: boolean;
  action: () => void;
}

export class StoryCard {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly text: HTMLParagraphElement;
  private readonly row: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    this.title = document.createElement('h2');
    this.text = document.createElement('p');
    this.text.className = 'hint';
    this.row = document.createElement('div');
    this.row.className = 'row';
    dialog.append(this.title, this.text, this.row);
    this.root.append(dialog);
    document.body.append(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(title: string, text: string, buttons: readonly CardButton[]): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.row.replaceChildren(
      ...buttons.map((b) => {
        const button = document.createElement('button');
        button.className = b.primary ? 'btn primary' : 'btn';
        button.textContent = b.label;
        button.addEventListener('click', () => {
          this.hide();
          b.action();
        });
        return button;
      }),
    );
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
