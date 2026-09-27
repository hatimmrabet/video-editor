import {choice, number, text, texts} from '../options/Param.ts';
import {scene} from './define.ts';

/* Height of one row, in design pixels. */
export const ROW_HEIGHT = 100;

export const CHECKLIST = scene({
  about: 'A list of rows that tick one after another.',
  when: 'The speaker counts things off, or lists conditions, steps or rules.',
  bottom: ({items}) => 640 + Math.max(0, items.length - 4) * ROW_HEIGHT,
  params: {
    title: text({about: 'Heading above the list.'}),
    items: texts({about: 'One row per item.', required: true, min: 1, max: 6}),
    sync: choice(['TIME', 'WORDS'] as const, {
      about: 'What paces the ticks: TIME spreads them over the scene; WORDS ticks the Nth row as the Nth word of the sentence is spoken.',
      default: 'TIME',
    }),
    y: number({about: 'Where the first row sits, as a share of the scene area\'s own height.', default: 0.22, min: 0, max: 1}),
  },
});
