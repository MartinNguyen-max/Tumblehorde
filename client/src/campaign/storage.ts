import { type CampaignSave, parseSave } from '@tumblehorde/shared';

/** The campaign's one save slot in the browser. */

const KEY = 'tumblehorde.campaign';

export function loadSave(): CampaignSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    return parseSave(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** False when the browser refuses (private mode, full storage); the story then lasts this visit only. */
export function writeSave(save: CampaignSave): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
