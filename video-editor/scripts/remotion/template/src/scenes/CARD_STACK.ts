import {choice, flag, number, texts} from '../options/Param.ts';
import {scene} from './define.ts';

/* The card grid's geometry, in design pixels (a 1080x1920 canvas). The component draws with it
   and `bottom` measures with it. */
export const CARD = {w: 418, h: 124, gapX: 40, gapY: 30, centreY: 384, margin: 60};

export const CARD_STACK = scene({
  about: 'Cards that pop in one by one, then flip with a check mark.',
  when: 'The speaker counts things off, one card per item.',
  bottom: ({items, columns}) => {
    const rows = Math.ceil(items.length / columns);
    return rows <= 2 ? 520 : CARD.centreY + (rows * CARD.h + (rows - 1) * CARD.gapY) / 2;
  },
  params: {
    items: texts({about: 'One card per item.', required: true, min: 1, max: 6}),
    columns: number({about: 'Cards per row. Cards narrow to fit the screen.', default: 2, min: 1, max: 3, whole: true}),
    checkmark: flag({about: 'Flip each card with a check mark.', default: true}),
    sync: choice(['TIME', 'WORDS'] as const, {
      about: 'What paces the flips: TIME flips them at `flipAt`; WORDS flips the Nth card as the Nth word of the sentence is spoken.',
      default: 'TIME',
    }),
    flipAt: number({about: 'When the cards flip with sync TIME, as a share of the scene.', default: 0.6, min: 0, max: 1}),
  },
});
