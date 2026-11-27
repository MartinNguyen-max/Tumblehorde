/**
 * Talks with people (E): a few lines, then maybe a choice. Pure data and a small cursor through
 * it; the client draws the words and the faces, and acts on the effect of a choice.
 */

/** How a line is said: drives the face, the gibberish voice and the music. */
export type Mood = 'neutral' | 'happy' | 'warm' | 'sad' | 'crying' | 'angry' | 'afraid' | 'surprised' | 'shout';

export interface Line {
  /** Who speaks; null for the narrator. */
  speaker: string | null;
  text: string;
  mood?: Mood;
}

export interface DialogueOption {
  text: string;
  /** Node to go on to; null ends the talk. */
  next: string | null;
  /** What choosing this means for the story, handled by the campaign flow. */
  effect?: string;
}

export interface DialogueNode {
  lines: readonly Line[];
  /** Offered after the last line; without options the talk goes on to `next` (or ends). */
  options?: readonly DialogueOption[];
  next?: string | null;
}

export interface Dialogue {
  start: string;
  nodes: Readonly<Record<string, DialogueNode>>;
}

export interface DialogueCursor {
  node: string;
  line: number;
}

export type DialogueView =
  | { kind: 'line'; line: Line }
  | { kind: 'choice'; options: readonly DialogueOption[] }
  | { kind: 'done' };

export function openDialogue(dialogue: Dialogue): DialogueCursor {
  return { node: dialogue.start, line: 0 };
}

/** What the player sees at the cursor. */
export function viewDialogue(dialogue: Dialogue, cursor: DialogueCursor): DialogueView {
  const node = dialogue.nodes[cursor.node];
  if (!node) return { kind: 'done' };
  const line = node.lines[cursor.line];
  if (line) return { kind: 'line', line };
  if (node.options && node.options.length > 0) return { kind: 'choice', options: node.options };
  return { kind: 'done' };
}

function goTo(cursor: DialogueCursor, next: string | null | undefined): DialogueCursor {
  return next ? { node: next, line: 0 } : { node: '', line: 0 };
}

/** On to the next line (E or click). At a choice, nothing happens: one must be picked. */
export function advanceDialogue(dialogue: Dialogue, cursor: DialogueCursor): DialogueCursor {
  const node = dialogue.nodes[cursor.node];
  if (!node) return cursor;
  if (cursor.line < node.lines.length - 1) return { node: cursor.node, line: cursor.line + 1 };
  if (node.options && node.options.length > 0) return { node: cursor.node, line: node.lines.length };
  return goTo(cursor, node.next);
}

/** Picks option `index` at a choice; returns the new cursor and the effect of the choice. */
export function chooseOption(dialogue: Dialogue, cursor: DialogueCursor, index: number): { cursor: DialogueCursor; effect: string | null } {
  const view = viewDialogue(dialogue, cursor);
  if (view.kind !== 'choice') return { cursor, effect: null };
  const option = view.options[index];
  if (!option) return { cursor, effect: null };
  return { cursor: goTo(cursor, option.next), effect: option.effect ?? null };
}
