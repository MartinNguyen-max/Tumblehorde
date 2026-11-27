import {
  CAMPAIGN,
  type CampaignSave,
  canWorkOut,
  type ChapterId,
  type Dialogue,
  type DialogueOption,
  type NpcRole,
  SHOP_ITEMS,
  type ShopItem,
} from '@tumblehorde/shared';

/**
 * Who says what in the city. Some talks depend on the story so far (Varro's shop knows your
 * gold), so they are built when the talk starts. Effects are handled by the campaign flow.
 */

export const EFFECT = {
  acceptJob: 'acceptJob',
  nextFight: 'nextFight',
  workout: 'workout',
  buy: (item: ShopItem) => `buy:${item}`,
} as const;

export function boughtItem(effect: string): ShopItem | null {
  const item = effect.startsWith('buy:') ? effect.slice(4) : '';
  return (SHOP_ITEMS as readonly string[]).includes(item) ? (item as ShopItem) : null;
}

const VARRO_JOB: Dialogue = {
  start: 'hello',
  nodes: {
    hello: {
      lines: [
        { speaker: 'Blacksmith', text: 'Hm. You have the look of a man who just walked out of a cell.', mood: 'neutral' },
        { speaker: 'Blacksmith', text: 'Bare hands, no coin, and hungry. I know that look. I wore it once.', mood: 'warm' },
        { speaker: 'Blacksmith', text: 'The arena pays twenty-five gold to whoever is still standing. Can you take a punch?', mood: 'neutral' },
      ],
      options: [
        { text: 'I can take a punch. Get me in.', next: 'yes', effect: EFFECT.acceptJob },
        { text: 'Not today.', next: 'no' },
      ],
    },
    yes: {
      lines: [
        { speaker: 'Blacksmith', text: 'Ha! Good. Varro. That is my name, and the arena knows it.', mood: 'happy' },
        { speaker: 'Varro', text: 'Do not die on me, boy. I hate wasting a good bet.', mood: 'happy' },
      ],
    },
    no: { lines: [{ speaker: 'Blacksmith', text: 'Suit yourself. Walk around. The city will still be here, and so will I.', mood: 'neutral' }] },
  },
};

const ITEM_NAMES: Record<ShopItem, string> = { armor: 'silver armor and a helmet', shield: 'a shield', sword: 'a real sword' };
const ITEM_LINES: Record<ShopItem, string> = {
  armor: 'Silver plates and a helmet. Put them on, right here. There. Now you look like you mean it.',
  shield: 'Oak and iron. Hold it high and they will break their swords on it.',
  sword: 'Balanced. Sharp. Better than that borrowed stick, I promise you.',
};

function varroShop(save: CampaignSave): Dialogue {
  const options: DialogueOption[] = SHOP_ITEMS.filter((item) => !save.gear[item]).map((item) => {
    const price = CAMPAIGN.prices[item];
    const affordable = save.gold >= price;
    return { text: `Buy ${ITEM_NAMES[item]} (${price} gold)`, next: affordable ? `sold-${item}` : 'poor', effect: affordable ? EFFECT.buy(item) : undefined };
  });
  options.push({ text: 'I am ready for the next fight.', next: 'fight', effect: EFFECT.nextFight });
  options.push({ text: 'Nothing for now.', next: null });
  const nodes: Record<string, Dialogue['nodes'][string]> = {
    hello: {
      lines: [{ speaker: 'Varro', text: `${save.gold} gold in your purse, apprentice. What will it be?`, mood: 'warm' }],
      options,
    },
    poor: { lines: [{ speaker: 'Varro', text: 'Not enough coin. Win me another fight and we will talk.', mood: 'neutral' }] },
    fight: { lines: [{ speaker: 'Varro', text: 'Then go and win. And come back in one piece, you hear me?', mood: 'warm' }] },
  };
  for (const item of SHOP_ITEMS) nodes[`sold-${item}`] = { lines: [{ speaker: 'Varro', text: ITEM_LINES[item], mood: 'happy' }] };
  return { start: 'hello', nodes };
}

function oneLine(speaker: string, text: string): Dialogue {
  return { start: 'line', nodes: { line: { lines: [{ speaker, text }] } } };
}

function trainer(save: CampaignSave, chapter: ChapterId): Dialogue {
  if (chapter !== 'apprentice') return oneLine('Old Gaius', 'Fighters train here. Come back when you are one.');
  if (!canWorkOut(save)) return oneLine('Old Gaius', 'Enough! Muscles grow while you rest, boy. Go and fight.');
  const left = CAMPAIGN.maxWorkouts - save.workouts;
  return oneLine('Old Gaius', `Lift the stone: left, right, left, right, fast! You have ${left} more in you today.`);
}

/** The talk for a story character, or null for small talk. */
export function storyDialogue(id: string, save: CampaignSave, chapter: ChapterId): Dialogue | null {
  if (id === 'varro') return chapter === 'capital' ? VARRO_JOB : varroShop(save);
  if (id === 'trainer') return trainer(save, chapter);
  return null;
}

/** What townsfolk without a story say when spoken to: one line each, picked at random. */
export const SMALL_TALK: Readonly<Record<NpcRole, readonly string[]>> = {
  baker: ['Fresh bread! Well, fresh this morning.', 'No coin, no bread. Sorry, friend.', 'Mind the flour.'],
  guard: ['Move along.', 'Keep your hands where I can see them.', 'No trouble today, understood?'],
  child: ['Are you a gladiator? You smell like one!', 'Tag! You are it!', 'My father says the arena is not for children.'],
  merchant: ['Silks from the east! Too rich for you, I think.', 'Come back with gold, my friend.', 'Pepper, saffron, cinnamon! Smell it!'],
  citizen: ['Lovely weather for the games.', 'Have you heard? The emperor will watch the fights this season.', 'Out of my way, please.', 'They say Draco has never lost a fight.'],
  reveller: ['Festival! Drink with us!', 'Hic. Have you seen my sandal?', 'Dance with me! No? Your loss!'],
  smith: ['The forge is hot. Do not touch anything.'],
};
