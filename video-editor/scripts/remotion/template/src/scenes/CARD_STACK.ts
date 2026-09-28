import {choice, flag, number, texts} from '../options/Param.ts';
import {scene} from './define.ts';

export const CARD_STACK = scene({
  about: 'Cards that pop in one by one, then flip with a check mark.',
  when: 'The speaker counts things off, one card per item.',
  params: {
    items: texts({about: 'One card per item.', required: true, min: 1, max: 6}),
    columns: number({about: 'Cards per row. The output is a vertical video: one column, '
      + 'stacked downward, reads better than several side by side — raise it only for many '
      + 'short items that genuinely need to fit side by side.', default: 1, min: 1, max: 3, whole: true}),
    checkmark: flag({about: 'Flip each card with a check mark.', default: true}),
    sync: choice(['TIME', 'WORDS'] as const, {
      about: 'What paces the flips: TIME flips them at `flipAt`; WORDS flips the Nth card as the Nth word of the sentence is spoken.',
      default: 'TIME',
    }),
    flipAt: number({about: 'When the cards flip with sync TIME, as a share of the scene.', default: 0.6, min: 0, max: 1}),
  },
});
