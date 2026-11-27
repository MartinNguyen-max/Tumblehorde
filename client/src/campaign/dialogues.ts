import type { Dialogue, NpcRole } from '@tumblehorde/shared';

/** Who says what in the city. Effects are handled by the campaign flow. */

export const EFFECT = {
  acceptJob: 'acceptJob',
} as const;

export const DIALOGUES: Readonly<Record<string, Dialogue>> = {
  'varro-job': {
    start: 'hello',
    nodes: {
      hello: {
        lines: [
          { speaker: 'Varro', text: 'Hm. You have the look of a man who just walked out of a cell.', mood: 'neutral' },
          { speaker: 'Varro', text: 'Bare hands, no coin, and hungry. I know that look. I wore it once.', mood: 'warm' },
          { speaker: 'Varro', text: 'The arena pays twenty-five gold to whoever is still standing. Can you take a punch?', mood: 'neutral' },
        ],
        options: [
          { text: 'I can take a punch. Get me in.', next: 'yes', effect: EFFECT.acceptJob },
          { text: 'Not today.', next: 'no' },
        ],
      },
      yes: {
        lines: [
          { speaker: 'Varro', text: 'Ha! Good. Do not die on me, boy. I hate wasting a good bet.', mood: 'happy' },
        ],
      },
      no: {
        lines: [
          { speaker: 'Varro', text: 'Suit yourself. Walk around. The city will still be here, and so will I.', mood: 'neutral' },
        ],
      },
    },
  },
};

/** What townsfolk without a story say when spoken to: one line each, picked at random. */
export const SMALL_TALK: Readonly<Record<NpcRole, readonly string[]>> = {
  baker: ['Fresh bread! Well, fresh this morning.', 'No coin, no bread. Sorry, friend.', 'Mind the flour.'],
  guard: ['Move along.', 'Keep your hands where I can see them.', 'No trouble today, understood?'],
  child: ['Are you a gladiator? You smell like one!', 'Tag! You are it!', 'My father says the arena is not for children.'],
  merchant: ['Silks from the east! Too rich for you, I think.', 'Come back with gold, my friend.'],
  citizen: ['Lovely weather for the games.', 'Have you heard? The emperor will watch the fights this season.', 'Out of my way, please.'],
  reveller: ['Festival! Drink with us!', 'Hic. Have you seen my sandal?'],
  smith: ['The forge is hot. Do not touch anything.'],
};
