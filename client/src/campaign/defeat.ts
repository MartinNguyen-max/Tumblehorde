/**
 * A lost story battle: try it again from its start, or leave (the story stays saved at this
 * battle). Built once, shown when needed.
 */
export class DefeatCard {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly text: HTMLParagraphElement;
  private onRetry: () => void = () => undefined;
  private onLeave: () => void = () => undefined;

  constructor() {
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
    const retry = document.createElement('button');
    retry.className = 'btn primary';
    retry.textContent = 'Fight again';
    retry.addEventListener('click', () => {
      this.hide();
      this.onRetry();
    });
    const leave = document.createElement('button');
    leave.className = 'btn';
    leave.textContent = 'Leave to menu';
    leave.addEventListener('click', () => {
      this.hide();
      this.onLeave();
    });
    row.append(retry, leave);
    dialog.append(this.title, this.text, row);
    this.root.append(dialog);
    document.body.append(this.root);
  }

  show(title: string, text: string, onRetry: () => void, onLeave: () => void): void {
    this.title.textContent = title;
    this.text.textContent = text;
    this.onRetry = onRetry;
    this.onLeave = onLeave;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
